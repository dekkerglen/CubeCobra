# Making Demos

A demo is a great way to allow people to try out your new feature and test for bugs without having to download the code. This folder has machinery to do that on the AWS serverless infrastructure.

## Instructions

### AWS

1. Start by making an [AWS account](aws.amazon.com).
1. Once you’ve created your account, go to the [IAM console](https://console.aws.amazon.com/iam) to create an IAM user for yourself.
1. Click on [users](https://console.aws.amazon.com/iam/home#/users) and add a user with “Programmatic Access.”
1. On the permissions page, go to “Attach Existing Policies” and add the following policies to your new user:
    1. AWSLambdaFullAccess
    1. IAMFullAccess
    1. AmazonS3FullAccess
    1. CloudFrontFullAccess
    1. AmazonAPIGatewayAdministrator
    1. AWSCloudFormationFullAccess
1. You don’t need to add any tags to your user.
1. Once your user is created, go to the user’s “Security credentials” tab and create a new access key.
1. Copy the access key into `~/.aws/credentials` in the following format:
    ```
    [default]
    aws_access_key_id=xxx
    aws_secret_access_key=xxxx
    ```

### MongoDB Atlas

1. Create a new Sandbox-tier mongo database on [](mongodb.com).
1. Copy the connection string into `demos/config.yml` in the following format:
    ```
    mongodbUrl: mongodb+srv://..../
    ```

### Creating the demo

You should now be ready to go. Run `demos/make_demo.sh` with the name of your demo, which should be globally unique. It will take a while for the first deploy for each demo. Let @phulin know on the discord if you have issues.

Once you have run `make_demo.sh` once, you can deploy updates much more quickly with `npm run-script build && sls deploy -f handler --stage <name>`
