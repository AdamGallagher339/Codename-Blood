import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

export class InfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Motorcycles Table
    new dynamodb.Table(this, 'MotorcyclesTable', {
      tableName: 'Motorcycles',
      partitionKey: { name: 'BikeID', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // Ride Sessions Table
    new dynamodb.Table(this, 'RideSessionsTable', {
      tableName: 'RideSessions',
      partitionKey: { name: 'SessionID', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'BikeID', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // Issue Reports Table
    new dynamodb.Table(this, 'IssueReportsTable', {
      tableName: 'IssueReports',
      partitionKey: { name: 'IssueID', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });
  }
}
