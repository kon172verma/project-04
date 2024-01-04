This repository contains code to get Federated Identity from Cognito User Pool, and then use that to create a S3Client which will be able to download files from S3.
This S3 does not have public access, but the Federated Identity has an IAM Role attached which allows user to access S3 bucket.
