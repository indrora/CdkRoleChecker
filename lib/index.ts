import { Annotations, Aspects, aws_iam, IAspect } from 'aws-cdk-lib';
import { ImagePullPrincipalType } from 'aws-cdk-lib/aws-codebuild';
import { CfnRole, Policy, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { isMaster } from 'cluster';
import { Construct, IConstruct } from 'constructs';
import minimatch
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export interface CdkRoleCheckerProps {
  // Define construct properties here
  /**
   * Banned Services which must not be used
   *
   * @default - none, all services can be called by the role
   */
  readonly bannedServices?: string[]
  /**
   * Roles may use the following AWS calls (in IAM-style service:call format)
   * @default - noe, all 
   */
  readonly allowList?: string[]
  /**
   * 
   * Roles may never use any of these AWS calls (in iam-style service:call format)
   * @default - None
   */
  readonly denyList?: string[]

  readonly allowPrincipal?: string[]

  /**
   * Ban wildcard statements ("iam:*" and similar)
   * @default false
   */
  readonly noWildcardCalls?: Boolean

  readonly noWildcardResources?: Boolean
}



export class CdkRoleChecker implements IAspect {

  private allowedCalls?: string[]
  private deniedCalls?: string[]
  private banServices?: string[]
  private allowPrincipals?: string[]
  private banWildcardCalls: Boolean

  constructor(props: CdkRoleCheckerProps = {}) {

    this.allowedCalls = props.allowList
    this.allowPrincipals = props.allowPrincipal;

    this.banWildcardCalls = props.noWildcardCalls ?? false

  }
  visit(node: IConstruct): void {
    if (node instanceof aws_iam.Role) {

      const cfnRole = (node.node.findChild('Resource') as CfnRole);
      for (const policy of (cfnRole.policies as CfnRole.PolicyProperty[])) {
        for (const pStatement of policy.policyDocument.statements as PolicyStatement[]) {
          if (!this.check(pStatement, node)) {
            Annotations.of(node).addError("Role does not conform to requirements")
          }
        }
      }
    }
  }

  public check(statement: PolicyStatement, role: aws_iam.Role): Boolean {

    // Deny statements are out of scope here, as they're default. 
    if (statement.effect == aws_iam.Effect.DENY) {
      return true;
    }

    // Easy first pass: Are there any wildcards and should we care? 
    if (this.banWildcardCalls) {
      if (statement.actions.some((x) => { x.endsWith('*') })) {
        console.error("Found wildcard: " + statement.actions.find((x) => { x.endsWith('*') }))
        Annotations.of(role).addError("Found wildcard!");
      }
    }

    if (this.allowedCalls) {
      // Check each call to make sure that it is allowed.
      for (const checkCall of statement.actions) {
        // If it's already there, no problem. 
        if (this.allowedCalls.includes(checkCall)) {
          if (checkCall.indexOf('*') >= 0 && this.banWildcardCalls) {
            Annotations.of(role).addError("Banned wildcard found: "+checkCall);
          }
          continue;
        }
        // Check if it's a wildcard
        if (checkCall.indexOf('*') >= 0) {
          // if we ban wildcards, mark it and continue
          if (this.banWildcardCalls) {
            // Not okay
            Annotations.of(role).addError("Banned wildcard found: "+checkCall)
            continue;
          }
          
          const unwildcard = checkCall.replace('*', '')
          
          // 
          
        }
      }
    }


    return true;
  }

}