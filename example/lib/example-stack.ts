import { Aspects, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CdkRoleChecker } from 'cdk-role-checker';
import * as lambda from 'aws-cdk-lib/aws-lambda'
import * as s3 from 'aws-cdk-lib/aws-s3'

export class ExampleStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // The code that defines your stack goes here

    const fn = new lambda.Function(this, 'myLambda', {
      code: new lambda.InlineCode('function handler(a,b) { }'),
      handler: 'index.handler',
      runtime: lambda.Runtime.NODEJS_14_X,
    });
    const bk = new s3.Bucket(this, 'mybucket')
    bk.grantRead(fn)

    Aspects.of(this).add(new CdkRoleChecker({'allowList':['s3:Get*']}))
  }
}
