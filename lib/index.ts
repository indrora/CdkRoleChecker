import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export interface CdkRoleCheckerProps {
  // Define construct properties here
}

export class CdkRoleChecker extends Construct {

  constructor(scope: Construct, id: string, props: CdkRoleCheckerProps = {}) {
    super(scope, id);

    // Define construct contents here

    // example resource
    // const queue = new sqs.Queue(this, 'CdkRoleCheckerQueue', {
    //   visibilityTimeout: cdk.Duration.seconds(300)
    // });
  }
}
