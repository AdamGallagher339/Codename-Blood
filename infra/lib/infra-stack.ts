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

    // Fleet Tracker Tables
    const fleetBikesTable = new dynamodb.Table(this, 'FleetBikesTable', {
      tableName: 'FleetBikes',
      partitionKey: { name: 'BikeID', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    const fleetServiceTable = new dynamodb.Table(this, 'FleetServiceHistoryTable', {
      tableName: 'FleetServiceHistory',
      partitionKey: { name: 'BikeID', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'ServiceID', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // ------------------------------
    //      MAIN BACKEND TABLES
    // ------------------------------
    // These tables support the Go backend repo layer (USERS_TABLE, BIKES_TABLE, ...)

    const usersTable = new dynamodb.Table(this, 'UsersTable', {
      tableName: 'Users',
      partitionKey: { name: 'riderId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    const bikesTable = new dynamodb.Table(this, 'BikesTable', {
      tableName: 'Bikes',
      partitionKey: { name: 'id', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    // Optional / forward-compat tables (backend code supports them but may not expose endpoints yet)
    const depotsTable = new dynamodb.Table(this, 'DepotsTable', {
      tableName: 'Depots',
      partitionKey: { name: 'depotId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    });

    const jobsTable = new dynamodb.Table(this, 'JobsTable', {
      tableName: 'Jobs',
      partitionKey: { name: 'jobId', type: dynamodb.AttributeType.STRING },
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

    // Cognito groups used for roles/authorization.
    // NOTE: AdminAddUserToGroup/AdminRemoveUserFromGroup require groups to exist.
    new cognito.CfnUserPoolGroup(this, 'GroupBloodBikeAdmin', {
      userPoolId: userPool.userPoolId,
      groupName: 'BloodBikeAdmin',
      description: 'Administrators',
    });
    new cognito.CfnUserPoolGroup(this, 'GroupRider', {
      userPoolId: userPool.userPoolId,
      groupName: 'Rider',
      description: 'Riders',
    });
    new cognito.CfnUserPoolGroup(this, 'GroupDispatcher', {
      userPoolId: userPool.userPoolId,
      groupName: 'Dispatcher',
      description: 'Dispatchers',
    });
    new cognito.CfnUserPoolGroup(this, 'GroupFleetManager', {
      userPoolId: userPool.userPoolId,
      groupName: 'FleetManager',
      description: 'Fleet managers',
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
      new CfnOutput(this, 'FleetBikesTableName', { value: fleetBikesTable.tableName });
      new CfnOutput(this, 'FleetServiceTableName', { value: fleetServiceTable.tableName });

      // Outputs for backend integration
      new CfnOutput(this, 'UsersTableName', { value: usersTable.tableName });
      new CfnOutput(this, 'BikesTableName', { value: bikesTable.tableName });
      new CfnOutput(this, 'DepotsTableName', { value: depotsTable.tableName });
      new CfnOutput(this, 'JobsTableName', { value: jobsTable.tableName });


  }
}
