import { Annotations, aws_iam, IAspect } from 'aws-cdk-lib';
import { CfnRole,  PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { IConstruct } from 'constructs';

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
    this.deniedCalls  = props.denyList
    this.banWildcardCalls = props.banWildcards ?? false
    this.visitedNodes = []

  }
  visit(node: IConstruct): void {
    if (node instanceof aws_iam.Role) {

      const nodepath = node.node.path

      if(this.visitedNodes.includes(nodepath)) {
        return;
      }
      const cfnRole = (node.node.findChild('Resource') as CfnRole);
      for (const policy of (cfnRole.policies as CfnRole.PolicyProperty[])) {
        for (const pStatement of policy.policyDocument.statements as PolicyStatement[]) {
          if (!this.check(pStatement, node)) {
            Annotations.of(node).addInfo("Role does not conform to requirements");
          }
        }
      }

      this.visitedNodes.push(nodepath);
    }
  }

  public check(statement: PolicyStatement, role: aws_iam.Role)  {

    // Deny statements are out of scope here, as they're default. 
    if (statement.effect == aws_iam.Effect.DENY) {
      return true;
    }

    // Easy first pass: Are there any wildcards and should we care? 
    if (this.banWildcardCalls) {
      // If wildcards are banned, 
      const maybeWildcards = statement.actions.filter( ( s ) => s.endsWith("*"))
      for(const wildAction of maybeWildcards) {
        Annotations.of(role).addError("Wildcard used: "+wildAction);
      }
    }
  
    // Second pass: Wildcards must have their wildcard at the end, not the middle. 
    // While IAM doesn't technically allow it, we're going to enforce well-formed wildcards:

    if(statement.actions.some((a) => {a.indexOf('*') != -1 && !a.endsWith("*")})) {
      Annotations.of(role).addWarning("You have described a wildcard with a suffix and prefix. This is likely not invalid but may lead to unintended consequences.");
    }

    if(this.allowedCalls) {
      // Check each call in the statement to make sure it's in the allowed list
      for(const checkCall of statement.actions) {
        if(!checkCall.endsWith("*") && !this.allowedCalls.some((x)=> minimatch(checkCall, x))) {
          Annotations.of(role).addError("Role "+role.roleName+" contains non-cleared permission "+checkCall)
        } else if(checkCall.endsWith("*") && !this.banWildcardCalls) {
          // Wildcards are special. Wildcards must be a subset of *another* wildcard. 
          const possibleSuperset = this.allowedCalls.filter((s)=>s.endsWith("*"));
          
          const trimmed = checkCall.substring(0,checkCall.length-1);

          if(!possibleSuperset.includes(checkCall) && !possibleSuperset.some( (x) => minimatch(trimmed, x) )) {
            // There's no wildcard that matches it, or no direct literal.
            console.log("Adding error for "+checkCall)
            Annotations.of(role).addError("Role contains a wildcard with greater scope than allowed");
          }
        }
      }
    } else if(this.deniedCalls) {
      for(const denycall of this.deniedCalls) {
        
        // No statement actions should be or resolve to denycall
        const maybeBanned = statement.actions.filter( (x) => minimatch(x, denycall) || ( x.endsWith('*') && minimatch(denycall, x)) ) ;
        if(maybeBanned.length > 0 ) {
          Annotations.of(role).addError("Role contains denied calls: "+maybeBanned.join(',') )
        }
      }
    }
  }

}