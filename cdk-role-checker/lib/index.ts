import { Annotations, aws_iam, CfnResource, IAspect } from 'aws-cdk-lib';
import { ImagePullPrincipalType } from 'aws-cdk-lib/aws-codebuild';
import { CfnPolicy, CfnRole, Policy, PolicyDocument, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { Construct, IConstruct, Node } from 'constructs';

const minimatch = require("minimatch");

// import * as sqs from 'aws-cdk-lib/aws-sqs';

export interface CdkRoleCheckerProps {

  /**
   * Roles may use the following AWS calls (in IAM-style service:call format)
   * @default - None: All calls are allowed.
   */
  readonly allowList?: string[]
  /**
   * 
   * Roles may never use any of these AWS calls (in iam-style service:call format)
   * @default - None, no calls are denied explicitly.
   */
  readonly denyList?: string[]

  /**
   * Ban wildcard statements ("iam:*" and similar)
   * @default false
   */
  readonly banWildcards?: Boolean
}



export class CdkRoleChecker implements IAspect {

  private allowedCalls?: string[]
  private deniedCalls?: string[]
  private banWildcardCalls: Boolean
  private visitedNodes: string[]

  constructor(props: CdkRoleCheckerProps = {}) {

    this.allowedCalls = props.allowList
    this.deniedCalls = props.denyList
    this.banWildcardCalls = props.banWildcards ?? false
    this.visitedNodes = []

  }
  visit(node: IConstruct): void {



    const nodepath = node.node.path

    if (node.node.defaultChild !== undefined) {

      const x = (node.node.defaultChild as CfnResource)

      if (x.cfnResourceType == "AWS::IAM::Policy") {

        if (this.visitedNodes.includes(nodepath)) {
          return;
        }
        this.visitedNodes.push(nodepath);

        for (const pStatement of (x as CfnPolicy).policyDocument.statements as PolicyStatement[]) {
          if (0 < this.check(pStatement, node)) {
            Annotations.of(node).addInfo("Role does not conform to requirements");
          }
        }
      } else if (x.cfnResourceType == "AWS::IAM::Role") {

        if (this.visitedNodes.includes(nodepath)) {
          return;
        }
        this.visitedNodes.push(nodepath);


        const cfnRole = (node.node.findChild('Resource') as CfnRole);
        if(cfnRole.policies as  CfnRole.PolicyProperty[] != undefined )
        for (const policy of (cfnRole.policies as CfnRole.PolicyProperty[])) {
          for (const pStatement of policy.policyDocument.statements as PolicyStatement[]) {
            if (0 < this.check(pStatement, node)) {
              Annotations.of(node).addInfo("Role does not conform to requirements");
            }
          }
        }

      }
    }
  }


  public check(statement: PolicyStatement, role: IConstruct): number {

    // Deny statements are out of scope here, as they're default. 
    if (statement.effect == aws_iam.Effect.DENY) {
      return 0;
    }

    let errors = 0;

    // Easy first pass: Are there any wildcards and should we care? 
    if (this.banWildcardCalls) {
      // If wildcards are banned, 
      const maybeWildcards = statement.actions.filter((s) => s.endsWith("*"))
      for (const wildAction of maybeWildcards) {
        Annotations.of(role).addError("Wildcard used: " + wildAction);
        errors += 1;
      }
    }

    // Second pass: Wildcards must have their wildcard at the end, not the middle. 
    // While IAM doesn't technically allow it, we're going to enforce well-formed wildcards:

    if (statement.actions.some((a) => { a.indexOf('*') != -1 && !a.endsWith("*") })) {
      Annotations.of(role).addWarning("You have described a wildcard with a suffix and prefix. This is likely not invalid but may lead to unintended consequences.");
      errors += 1;
    }

    if (this.allowedCalls) {
      // Check each call in the statement to make sure it's in the allowed list
      for (const checkCall of statement.actions) {
        if (!checkCall.endsWith("*") && !this.allowedCalls.some((x) => minimatch(checkCall, x))) {
          Annotations.of(role).addError("statement in " + role.node.path + " contains non-cleared permission " + checkCall)
          errors += 1;
        } else if (checkCall.endsWith("*") && !this.banWildcardCalls) {
          // Wildcards are special. Wildcards must be a subset of *another* wildcard. 
          const possibleSuperset = this.allowedCalls.filter((s) => s.endsWith("*"));

          const trimmed = checkCall.substring(0, checkCall.length - 1);

          if (!possibleSuperset.includes(checkCall) && !possibleSuperset.some((x) => minimatch(trimmed, x))) {
            // There's no wildcard that matches it, or no direct literal.
            
            Annotations.of(role).addError("Statement contains a wildcard with greater scope than allowed");
            errors += 1;
          }
        }
      }
    } else if (this.deniedCalls) {
      for (const denycall of this.deniedCalls) {

        // No statement actions should be or resolve to denycall
        const maybeBanned = statement.actions.filter((x) => minimatch(x, denycall) || (x.endsWith('*') && minimatch(denycall, x)));
        if (maybeBanned.length > 0) {
          Annotations.of(role).addError("Statement contains denied calls: " + maybeBanned.join(','))
          errors += 1
        }
      }
    }

    return errors;
  }

}