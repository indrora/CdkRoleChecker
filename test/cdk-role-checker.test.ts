import * as cdk from "aws-cdk-lib";
import { Aspects } from "aws-cdk-lib";
import {Template} from "aws-cdk-lib/assertions";
import * as iam from "aws-cdk-lib/aws-iam"
import { addCustomSynthesis } from "aws-cdk-lib/core/lib/private/synthesis";
import * as CdkRoleChecker from "../lib/index";

// example test. To run these tests, uncomment this file along with the
// example resource in lib/index.ts
test("asdfasdf bananas", () => {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, "TestStack");
  
      // 👇 Create a Policy Document (Collection of Policy Statements)
      const filterLogEvents = new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            resources: ['arn:aws:logs:*:*:log-group:/aws/lambda/*'],
            actions: ['logs:FilterLogEvents','logs:touch*'],
            // 👇 Default for `effect` is ALLOW
            effect: iam.Effect.ALLOW,
          }),
        ],
      });
  
      // 👇 Create role, to which we'll attach our Policies
      const role = new iam.Role(stack, 'example-iam-role', {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        description: 'An example IAM role in AWS CDK',
        inlinePolicies: {
          // 👇 attach the Policy Document as inline policies
          FilterLogEvents: filterLogEvents,
        },
      });
    

  const checker = new CdkRoleChecker.CdkRoleChecker({
    'noWildcardCalls':true
  });
  Aspects.of(stack).add(checker);
  const template = Template.fromStack(stack);

  const end  = app.synth()

  
});
