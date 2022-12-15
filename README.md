# CdkRoleChecker

The CDK Role Checker is an Aspect for the CDK that enforces rules on the scope of roles in the CDK. 
It currently covers inline roles. 

# Usage

```ts

// Your typical process, right?
const app = new cdk.App();
const stack = new cdk.Stack(app, "TestStack");

// Add the Aspect to a role or stack -- anything from IConstruct. 

const checker = new CdkRoleChecker.CdkRoleChecker({denyList: ["test:t*"]});
Aspects.of(stack).add(checker);

```

The following configuration options are available: 

* `allowList`: Actions that are allowable, others denied (matches IAM's behavior in general)
* `denyList`:  Actions which must not be called, others allowed (the typical usage)
* `banWildcards`: Ban the use of any and all wildcard permissions in roles. 

# Caveats

* If you specify both an Allow and a Deny list, the Deny list is ignored.
* Any policy which is a DENY action policy is ignored during checking.
* This probably doesn't work with Managed Policies
* This is not a replacement for IAM guardrails, only a check to make sure you're not doing something outright silly
  like allowing a third party CDK Construct granting itself every permission under the sun.

# How it works

The checker looks for any roles or policies that are created by the CDK during synthesis, specifically finding anything
that has a final Cloudformation type of `AWS::IAM::Policy` or `AWS::IAM::Role`. 

## Useful commands

* `npm run build`   compile typescript to js
* `npm run watch`   watch for changes and compile
* `npm run test`    perform the jest unit tests
