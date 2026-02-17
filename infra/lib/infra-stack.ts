import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';   
import * as golambda from '@aws-cdk/aws-lambda-go-alpha';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';


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
    new cognito.CfnUserPoolGroup(this, 'GroupHR', {
      userPoolId: userPool.userPoolId,
      groupName: 'HR',
      description: 'Human Resources',
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

      // ------------------------------
      //      MAIN BACKEND API LAMBDA
      // ------------------------------

      const backendApiLambda = new golambda.GoFunction(this, 'BackendApiLambda', {
        entry: '../backend/lambda/api',
        functionName: 'BackendApi',
        architecture: lambda.Architecture.X86_64,
        environment: {
          // AWS
          AWS_REGION: this.region,

          // Cognito
          COGNITO_USER_POOL_ID: userPool.userPoolId,
          COGNITO_CLIENT_ID: userPoolClient.userPoolClientId,
          // Only needed if the Cognito client is created with generateSecret: true.
          // Currently empty because the client has generateSecret: false.
          COGNITO_CLIENT_SECRET: '',

          // DynamoDB tables (main backend)
          USERS_TABLE: usersTable.tableName,
          BIKES_TABLE: bikesTable.tableName,
          DEPOTS_TABLE: depotsTable.tableName,
          JOBS_TABLE: jobsTable.tableName,

          // DynamoDB tables (fleet tracker)
          FLEET_BIKES_TABLE: fleetBikesTable.tableName,
          FLEET_SERVICE_TABLE: fleetServiceTable.tableName,
        },
      });

      usersTable.grantReadWriteData(backendApiLambda);
      bikesTable.grantReadWriteData(backendApiLambda);
      depotsTable.grantReadWriteData(backendApiLambda);
      jobsTable.grantReadWriteData(backendApiLambda);
      fleetBikesTable.grantReadWriteData(backendApiLambda);
      fleetServiceTable.grantReadWriteData(backendApiLambda);

      // Allow syncing roles to Cognito groups (Admin* APIs).
      backendApiLambda.addToRolePolicy(
        new iam.PolicyStatement({
          actions: [
            'cognito-idp:AdminListGroupsForUser',
            'cognito-idp:AdminAddUserToGroup',
            'cognito-idp:AdminRemoveUserFromGroup',
          ],
          resources: [userPool.userPoolArn],
        })
      );

      // ------------------------------
      //      /api/* ROUTING
      // ------------------------------
      // Public endpoints: /api/health and signup/confirm/signin.
      // Protected endpoints: everything else under /api/{proxy+} via Cognito authorizer.

      const backendIntegration = new apigw.LambdaIntegration(backendApiLambda);

      const apiResource = api.root.addResource('api');

      // GET /api/health (public)
      const healthResource = apiResource.addResource('health');
      healthResource.addMethod('GET', backendIntegration);
      healthResource.addCorsPreflight({
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: ['GET', 'OPTIONS'],
        allowHeaders: ['Authorization', 'Content-Type'],
      });

      // POST /api/auth/signup|confirm|signin (public)
      const authResource = apiResource.addResource('auth');
      const signupResource = authResource.addResource('signup');
      signupResource.addMethod('POST', backendIntegration);
      signupResource.addCorsPreflight({
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: ['POST', 'OPTIONS'],
        allowHeaders: ['Authorization', 'Content-Type'],
      });

      const confirmResource = authResource.addResource('confirm');
      confirmResource.addMethod('POST', backendIntegration);
      confirmResource.addCorsPreflight({
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: ['POST', 'OPTIONS'],
        allowHeaders: ['Authorization', 'Content-Type'],
      });

      const signinResource = authResource.addResource('signin');
      signinResource.addMethod('POST', backendIntegration);
      signinResource.addCorsPreflight({
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: ['POST', 'OPTIONS'],
        allowHeaders: ['Authorization', 'Content-Type'],
      });

      // /api/{proxy+} (protected)
      const apiProxy = apiResource.addProxy({ anyMethod: false });
      apiProxy.addMethod('ANY', backendIntegration, {
        authorizer,
        authorizationType: apigw.AuthorizationType.COGNITO,
      });
      apiProxy.addCorsPreflight({
        allowOrigins: apigw.Cors.ALL_ORIGINS,
        allowMethods: apigw.Cors.ALL_METHODS,
        allowHeaders: ['Authorization', 'Content-Type'],
      });

      // CloudFormation outputs for frontend integration
      new CfnOutput(this, 'UserPoolId', { value: userPool.userPoolId });
      new CfnOutput(this, 'UserPoolClientId', { value: userPoolClient.userPoolClientId });
      new CfnOutput(this, 'FleetBikesTableName', { value: fleetBikesTable.tableName });
      new CfnOutput(this, 'FleetServiceTableName', { value: fleetServiceTable.tableName });
      new CfnOutput(this, 'ApiBaseUrl', { value: api.url });

      // Outputs for backend integration
      new CfnOutput(this, 'UsersTableName', { value: usersTable.tableName });
      new CfnOutput(this, 'BikesTableName', { value: bikesTable.tableName });
      new CfnOutput(this, 'DepotsTableName', { value: depotsTable.tableName });
      new CfnOutput(this, 'JobsTableName', { value: jobsTable.tableName });


  }
}
