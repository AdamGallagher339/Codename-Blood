import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';   
import * as golambda from '@aws-cdk/aws-lambda-go-alpha';
import * as apigw from 'aws-cdk-lib/aws-apigateway';


export class InfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Motorcycles Table
    const motorcyclesTable = new dynamodb.Table(this, 'MotorcyclesTable', {
      tableName: 'Motorcycles',
      partitionKey: { name: 'BikeID', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // Ride Sessions Table
    const rideSessionsTable = new dynamodb.Table(this, 'RideSessionsTable', {
      tableName: 'RideSessions',
      partitionKey: { name: 'SessionID', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'BikeID', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // Issue Reports Table
    const issueReportsTable = new dynamodb.Table(this, 'IssueReportsTable', {
      tableName: 'IssueReports',
      partitionKey: { name: 'IssueID', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // ------------------------------
    //      GET BIKES LAMBDA
    // ------------------------------

    const getBikesLambda = new golambda.GoFunction(this, 'GetBikesLambda', {
      entry: '../backend/lambda/getBikes',
      functionName: 'GetBikes',
      architecture: lambda.Architecture.X86_64,
      environment: {
        MOTORCYCLES_TABLE: motorcyclesTable.tableName,
      },
    });

    motorcyclesTable.grantReadData(getBikesLambda);

    const registerBikeLambda = new golambda.GoFunction(this, 'RegisterBikeLambda', {
      entry: '../backend/lambda/registerBike',
      functionName: 'RegisterBike',
      architecture: lambda.Architecture.X86_64,
      environment: {
        MOTORCYCLES_TABLE: motorcyclesTable.tableName,
      },
    });
    motorcyclesTable.grantWriteData(registerBikeLambda);



    // ------------------------------
    //      API GATEWAY
    // ------------------------------

    const api = new apigw.RestApi(this, 'FleetApi', {
        restApiName: 'BloodBike Fleet API',
      });

      // Create /bikes resource
      const bikesResource = api.root.addResource('bikes');

      // GET /bikes → GetBikesLambda
      bikesResource.addMethod(
        'GET',
        new apigw.LambdaIntegration(getBikesLambda)
      );

      // POST /bikes → RegisterBikeLambda
      bikesResource.addMethod(
        'POST',
        new apigw.LambdaIntegration(registerBikeLambda)
      );


  }
}
