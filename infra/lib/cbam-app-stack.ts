import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecr from "aws-cdk-lib/aws-ecr";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as ecsPatterns from "aws-cdk-lib/aws-ecs-patterns";
import * as elbv2 from "aws-cdk-lib/aws-elasticloadbalancingv2";
import * as secrets from "aws-cdk-lib/aws-secretsmanager";
import * as logs from "aws-cdk-lib/aws-logs";

export interface CbamAppStackProps extends cdk.StackProps {
  serviceName: string;
}

// Single-stack deployment for the reporting app on ECS Fargate.
//
//   GitHub Actions  -->  ECR  -->  Fargate task  <--  ALB  <--  internet
//                                       |
//                                       +--> Secrets Manager (API keys)
//                                       +--> CloudWatch Logs
//
// We're on Fargate (not App Runner) because App Runner's Envoy ingress
// buffers `text/event-stream` responses by default and our agent routes
// (/api/chat, /api/write) rely on incremental SSE flushes for live UI.
// ALB forwards bytes as they arrive — no buffering — and lets us tune
// idle timeout to fit the agent's tail latency.
export class CbamAppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: CbamAppStackProps) {
    super(scope, id, props);

    // ----- ECR repository (imported - already exists from prior deploys) -----
    const repo = ecr.Repository.fromRepositoryName(
      this,
      "AppRepo",
      props.serviceName
    );

    // ----- Secrets (imported by ARN from cdk.json context) -----
    const anthropicSecretArn = this.node.tryGetContext("anthropicSecretArn") as string;
    const voyageSecretArn = this.node.tryGetContext("voyageSecretArn") as string;
    if (!anthropicSecretArn || !voyageSecretArn) {
      throw new Error(
        "Missing context: pass -c anthropicSecretArn=... -c voyageSecretArn=... or set them in cdk.json"
      );
    }
    const anthropicSecret = secrets.Secret.fromSecretCompleteArn(
      this,
      "AnthropicApiKey",
      anthropicSecretArn
    );
    const voyageSecret = secrets.Secret.fromSecretCompleteArn(
      this,
      "VoyageApiKey",
      voyageSecretArn
    );

    // ----- VPC -----
    // 2 AZs, public subnets for ALB, private (NAT'd) subnets for tasks.
    // 1 NAT gateway is enough for this scale and saves $32/mo vs 2.
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: "public", subnetType: ec2.SubnetType.PUBLIC, cidrMask: 24 },
        { name: "private", subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
      ],
    });

    // ----- ECS cluster -----
    const cluster = new ecs.Cluster(this, "Cluster", {
      vpc,
      clusterName: props.serviceName,
      containerInsights: false, // off by default; flip to true if you need finer task metrics
    });

    // ----- Log group -----
    const logGroup = new logs.LogGroup(this, "AppLogs", {
      logGroupName: `/ecs/${props.serviceName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // ----- Fargate service -----
    // ApplicationLoadBalancedFargateService bundles task def + service +
    // ALB + target group + listener + DNS-friendly defaults in one shot.
    const service = new ecsPatterns.ApplicationLoadBalancedFargateService(
      this,
      "Service",
      {
        cluster,
        serviceName: props.serviceName,
        // 1 vCPU / 2 GB — matches the Agent SDK doc's 1 GiB minimum plus
        // headroom for the in-memory RAG index and Node heap.
        cpu: 1024,
        memoryLimitMiB: 2048,
        desiredCount: 1, // bump to 2+ for HA once you're confident
        publicLoadBalancer: true,
        assignPublicIp: false, // tasks live in private subnets, NAT for egress
        taskImageOptions: {
          image: ecs.ContainerImage.fromEcrRepository(repo, "latest"),
          containerPort: 8080,
          environment: {
            NODE_ENV: "production",
            NEXT_TELEMETRY_DISABLED: "1",
          },
          secrets: {
            ANTHROPIC_API_KEY: ecs.Secret.fromSecretsManager(anthropicSecret),
            VOYAGE_API_KEY: ecs.Secret.fromSecretsManager(voyageSecret),
          },
          logDriver: ecs.LogDrivers.awsLogs({
            streamPrefix: "app",
            logGroup,
          }),
        },
        // Force HTTP/1.1 between ALB and target — HTTP/2 backends with
        // streaming have caused us flakiness elsewhere; HTTP/1.1 streams
        // SSE reliably and the Next standalone server speaks h1 anyway.
        protocolVersion: elbv2.ApplicationProtocolVersion.HTTP1,
        circuitBreaker: { rollback: true },
      }
    );

    // ----- Health check on / -----
    // Static homepage, fast. Loose thresholds because cold starts pull
    // the 250 MB SDK binary into memory and JIT a non-trivial Next app.
    service.targetGroup.configureHealthCheck({
      path: "/",
      healthyHttpCodes: "200",
      interval: cdk.Duration.seconds(30),
      timeout: cdk.Duration.seconds(10),
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 5,
    });

    // ----- ALB idle timeout -----
    // Default is 60s. Our agent runs can stretch to ~60s today and longer
    // if maxTurns grows. 180s gives headroom without being unbounded.
    service.loadBalancer.setAttribute("idle_timeout.timeout_seconds", "180");

    // ----- Deregistration delay -----
    // Default 300s blocks fast deploys for 5 min. 30s is enough for in-flight
    // SSE streams to finish or be aborted by the client.
    service.targetGroup.setAttribute("deregistration_delay.timeout_seconds", "30");

    // ----- Outputs -----
    new cdk.CfnOutput(this, "ServiceUrl", {
      value: `http://${service.loadBalancer.loadBalancerDnsName}`,
      description: "Public HTTP URL of the ALB (add ACM cert for HTTPS)",
    });
    new cdk.CfnOutput(this, "ClusterName", {
      value: cluster.clusterName,
      description: "ECS cluster name",
    });
    new cdk.CfnOutput(this, "ServiceName", {
      value: service.service.serviceName,
      description: "ECS service name (use with ecs update-service for redeploys)",
    });
    new cdk.CfnOutput(this, "EcrRepoUri", {
      value: repo.repositoryUri,
      description: "Push images here; redeploy with: aws ecs update-service --force-new-deployment",
    });
    new cdk.CfnOutput(this, "AnthropicSecretArn", {
      value: anthropicSecret.secretArn,
      description: "Anthropic API key secret (imported)",
    });
    new cdk.CfnOutput(this, "VoyageSecretArn", {
      value: voyageSecret.secretArn,
      description: "Voyage API key secret (imported)",
    });
  }
}
