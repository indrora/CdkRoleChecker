import * as cdk from "aws-cdk-lib";
import {Annotations, Aspects, Stack} from "aws-cdk-lib";
import {assertions} from "aws-cdk-lib";
import {Match, Template} from "aws-cdk-lib/assertions";
import {GitHubEnterpriseSourceCredentials} from "aws-cdk-lib/aws-codebuild";
import {FireLensLogDriver} from "aws-cdk-lib/aws-ecs";
import * as iam from "aws-cdk-lib/aws-iam";
import {addCustomSynthesis} from "aws-cdk-lib/core/lib/private/synthesis";
import * as CdkRoleChecker from "../lib/index";

// example test. To run these tests, uncomment this file along with the
// example resource in lib/index.ts

function summonTestRole(stack : cdk.Stack, actions : string[]): iam.Role {
  const mPolicyDocument = new iam.PolicyDocument({
    statements: [new iam.PolicyStatement({resources: ["arn:aws:logs:*:*:log-group:/aws/testing/*"], actions: actions, effect: iam.Effect.ALLOW})]
  });

  const role = new iam.Role(stack, "example-iam-role", {
    assumedBy: new iam.ServicePrincipal("example-service.amazonaws.com"),
    description: "Role for testing",
    inlinePolicies: {
      FilterLogEvents: mPolicyDocument
    }
  });

  return role;
}

function getErrors(stack : cdk.Stack): any {
  return assertions.Annotations.fromStack(stack).findError("*", Match.anyValue());
}

test("AllowList with clean set", () => {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, "TestStack");
  const role = summonTestRole(stack, ["test:test"]);

  const checker = new CdkRoleChecker.CdkRoleChecker({allowList: ["test:test"]});
  Aspects.of(role).add(checker);

  const end = app.synth();

  const errors = getErrors(stack);
  expect(errors.length).toBe(0);
});

test("AllowList with wildcard", () => {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, "TestStack");
  const role = summonTestRole(stack, ["test:test"]);

  const checker = new CdkRoleChecker.CdkRoleChecker({allowList: ["test:*"]});
  Aspects.of(role).add(checker);

  const end = app.synth();

  const errors = getErrors(stack);
  expect(errors.length).toBe(0);
});

test("AllowList but overscoped subset", () => {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, "TestStack");
  const role = summonTestRole(stack, ["test:get*"]);

  const checker = new CdkRoleChecker.CdkRoleChecker({allowList: ["test:getLeft*"]});
  Aspects.of(role).add(checker);
  const end = app.synth();
  const errors = getErrors(stack);
  expect(errors.length).toBe(1);
});

test("Denylist with single item", () => {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, "TestStack");
  const role = summonTestRole(stack, ["test:test"]);

  const checker = new CdkRoleChecker.CdkRoleChecker({denyList: ["test:test"]});
  Aspects.of(role).add(checker);
  const end = app.synth();

  const errors = getErrors(stack);
  expect(errors.length).toBe(1);
});

test("Denylist is subset", () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, "TestStack");
    const role = summonTestRole(stack, ["test:test", "test:open", "test:cheese"]);
  
    const checker = new CdkRoleChecker.CdkRoleChecker({denyList: ["test:test"]});
    Aspects.of(role).add(checker);
    const end = app.synth();
  
    const errors = getErrors(stack);
    expect(errors.length).toBe(1);
  });

  test("Denylist with wildcard in role", () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, "TestStack");
    const role = summonTestRole(stack, ["test:t*"]);
  
    const checker = new CdkRoleChecker.CdkRoleChecker({denyList: ["test:test"]});
    Aspects.of(role).add(checker);
    const end = app.synth();
  
    const errors = getErrors(stack);
    expect(errors.length).toBe(1);
  });

  test("Denylist with wildcard in denied list", () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, "TestStack");
    const role = summonTestRole(stack, ["test:test"]);
  
    const checker = new CdkRoleChecker.CdkRoleChecker({denyList: ["test:t*"]});
    Aspects.of(role).add(checker);
    const end = app.synth();
  
    const errors = getErrors(stack);
    expect(errors.length).toBe(1);
  });



test("DenyList but everything is OK", () => {
  const app = new cdk.App();
  const stack = new cdk.Stack(app, "TestStack");
  const role = summonTestRole(stack, ["test:test"]);
  const checker = new CdkRoleChecker.CdkRoleChecker({denyList: ["test:getBar"]});
  Aspects.of(role).add(checker);
  const end = app.synth();

  const errors = getErrors(stack);
  expect(errors.length).toBe(0);
});

test("DenyList with wildcard", () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, "TestStack");
    const role = summonTestRole(stack, ["test:test"]);
  
  const checker = new CdkRoleChecker.CdkRoleChecker({denyList: ["test:*"]});
  Aspects.of(role).add(checker);

  const end = app.synth();

  const errors = getErrors(stack);
  expect(errors.length).toBe(1);
});

test("AllowList, clean, but with wildcards banned", () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, "TestStack");
    const role = summonTestRole(stack, ["test:test"]);
  
    const checker = new CdkRoleChecker.CdkRoleChecker({allowList: ["test:test"],banWildcards:true});
    Aspects.of(role).add(checker);
    const end = app.synth();
  
    const errors = getErrors(stack);
    expect(errors.length).toBe(0);
  });
  
  test("AllowList, but with wildcards banned.", () => {
    const app = new cdk.App();
    const stack = new cdk.Stack(app, "TestStack");
    const role = summonTestRole(stack, ["test:test", "test:generate*"]);
  
    const checker = new CdkRoleChecker.CdkRoleChecker({allowList: ["test:test"], banWildcards:true});
    Aspects.of(role).add(checker);
    const end = app.synth();
  
    const errors = getErrors(stack);
    console.log(errors);
    expect(errors.length).toBe(1);
  });
  