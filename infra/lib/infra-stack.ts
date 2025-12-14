import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';   
import * as golambda from '@aws-cdk/aws-lambda-go-alpha';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';


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
    // ------------------------------
    //      COGNITO (User Pool + Client)
    // ------------------------------

    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'BloodBikeUserPool',
      selfSignUpEnabled: true,
      signInAliases: { email: true },
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
      userPoolClientName: 'BloodBikeWebClient',
      generateSecret: false,
    });

    const api = new apigw.RestApi(this, 'FleetApi', {
        restApiName: 'BloodBike Fleet API',
      });

      // Cognito authorizer for API Gateway
      const authorizer = new apigw.CognitoUserPoolsAuthorizer(this, 'CognitoAuthorizer', {
        cognitoUserPools: [userPool],
      });

      // Create /bikes resource
      const bikesResource = api.root.addResource('bikes');

      // GET /bikes → GetBikesLambda
      bikesResource.addMethod(
        'GET',
        new apigw.LambdaIntegration(getBikesLambda)
      );

      // POST /bikes → RegisterBikeLambda (protected by Cognito)
      bikesResource.addMethod(
        'POST',
        new apigw.LambdaIntegration(registerBikeLambda),
        {
          authorizer,
          authorizationType: apigw.AuthorizationType.COGNITO,
        }
      );

      // CloudFormation outputs for frontend integration
      new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
      new CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });


  }
}
