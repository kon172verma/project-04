import { fromCognitoIdentityPool, CognitoIdentityCredentialProvider } from '@aws-sdk/credential-providers';
import * as S3 from '@aws-sdk/client-s3';
import axios from 'axios';
import * as fs from 'fs';
import { getErrorMessage, logger } from './logger';
import { S3_CREDENTIAL_PATH } from './config';

type S3Credentials = {
    refreshToken: string;
    tokenEndpoint: string;
    clientId: string;
    identityPoolId: {
        system: string;
    };
    authProvider: string;
    region: string;
};
let s3Credentials: S3Credentials;

async function getIdTokenFromRefreshToken(): Promise<string> {
    try {
        s3Credentials = JSON.parse(await fs.promises.readFile(S3_CREDENTIAL_PATH, 'utf-8')) as S3Credentials;
        logger.info('credentials loaded from', S3_CREDENTIAL_PATH);
    } catch (error) {
        logger.error('No credential file found in: ', S3_CREDENTIAL_PATH);
    }
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('client_id', s3Credentials.clientId);
    params.append('refresh_token', s3Credentials.refreshToken);
    const response = await axios.post(s3Credentials.tokenEndpoint, params);

    // NOTE: If there is a client secret attached to our app client, then we will need following headers.
    // const basic = 'Basic ' + Buffer.from(s3Credentials.clientId + ':' + s3Credentials.clientSecret).toString('base64');
    // const config = {
    //     headers: {
    //         'Content-Type': 'application/x-www-form-urlencoded',
    //         Authorization: basic,
    //     },
    // };
    // const response = await axios.post(s3Credentials.tokenEndpoint, params, config);

    return response.data.id_token as string;
}

async function createCredentialProvider(): Promise<CognitoIdentityCredentialProvider | null> {
    try {
        const idToken = await getIdTokenFromRefreshToken();
        const credential: CognitoIdentityCredentialProvider = fromCognitoIdentityPool({
            clientConfig: { region: s3Credentials.region },
            identityPoolId: s3Credentials.identityPoolId.system,
            logins: {
                [s3Credentials.authProvider]: idToken,
            },
        });
        return credential;
    } catch (error) {
        logger.error('Failed to create credential provider', getErrorMessage(error));
        return null;
    }
}

async function s3Client(): Promise<S3.S3Client> {
    try {
        const creds = await createCredentialProvider();
        if (creds === null) {
            logger.error('Could not retrieve AWS Credentials');
            throw new Error('Could not retrieve AWS credentials');
        }
        const s3Client = new S3.S3Client({
            region: s3Credentials.region,
            credentials: creds,
        });
        return s3Client;
    } catch (error) {
        const errorMessage = getErrorMessage(error);
        logger.error(`Error creating S3Client: ${errorMessage}`);
        throw new Error(`Error creating S3Client: ${errorMessage}`);
    }
}

async function s3GetObject(bucketName: string, key: string): Promise<S3.GetObjectCommandOutput> {
    try {
        const S3Client = await s3Client();
        const command = new S3.GetObjectCommand({
            Bucket: bucketName,
            Key: key,
        });
        const response = await S3Client.send(command);
        return response;
    } catch (error: any) {
        const errorMessage = getErrorMessage(error);
        if (error['code'] && error['code'] === 'ECONNRESET') {
            logger.error('Network Timeout, please check your network connection', 'Bucket name :', bucketName, 'Bucket path :', key);
            throw new Error(`Network timeout. Bucket: ${bucketName} File: ${key} Error:${errorMessage}`);
        } else {
            logger.error('S3 command failed', errorMessage, 'Bucket name :', bucketName, 'Bucket path :', key);
            throw new Error(`S3GetObject failed. Bucket: ${bucketName} File: ${key} Error:${errorMessage}`);
        }
    }
}

export const downloaderS3 = async (Bucket: string, data: { key: string; filePath: string }[]): Promise<void> => {
    try {
        await Promise.all(
            data.map(async (item, index) => {
                logger.info(`${index + 1} - Downloading: ${item.key}`);
                const result = await s3GetObject(Bucket, item.key);
                if (result !== undefined && result.Body !== undefined) {
                    const data = result.Body as unknown as string;
                    await fs.promises.writeFile(item.filePath, data);
                } else {
                    throw new Error(`${item.key} downloaded, but is corrupted`);
                }
            })
        );
    } catch (error) {
        const errorMessage = getErrorMessage(error);
        logger.debug('downloaderS3() Error: ', errorMessage);
        throw new Error(errorMessage);
    }
};
