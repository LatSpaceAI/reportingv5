#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { CbamAppStack } from "../lib/cbam-app-stack";

const app = new cdk.App();

// Account + region come from the standard CDK env vars. Default is
// ap-south-1 (Mumbai) — App Runner is supported there and it minimizes
// latency for India-based users. Override via CDK_DEFAULT_REGION.
const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? "ap-south-1",
};

new CbamAppStack(app, "CbamAppStack", {
  env,
  // Service name shows up in App Runner console + ECR repo name.
  serviceName: "cbam-app",
  description:
    "CBAM reporting app — Next.js + Claude Agent SDK on AWS App Runner",
});

app.synth();
