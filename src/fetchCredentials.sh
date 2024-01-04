#!/bin/bash

set -ue -o pipefail

SCRIPT_DIR=$(cd $(dirname $0); pwd)
cd $SCRIPT_DIR

PROFILE="private"
REGION="ap-south-1"

POOL_ID="ap-south-1_hJCdBhY9x"
CLIENT_ID="4p6jpq3v9r4hjnfo3qnc4n7t3t"

USER_ID="kon172verma"
PASSWORD="Thehindu@1991"

TOKEN_ENDPOINT="https://basic-auth-domain.auth.ap-south-1.amazoncognito.com/oauth2/token"
SYSTEM_IDENTITY_POOL_ID="ap-south-1:13e0bf6d-121a-4fe6-bff0-e2e81e52e0e8"

# 車載器をCognitoに追加
aws cognito-idp admin-create-user --profile $PROFILE --user-pool-id $POOL_ID --username "$USER_ID" --message-action SUPPRESS

# 車載器のパスワードを変更
aws cognito-idp admin-set-user-password --profile $PROFILE --user-pool-id $POOL_ID --username "$USER_ID" --password $PASSWORD --permanent

# リフレッシュトークンを取得
AUTH_INFO=$(aws cognito-idp admin-initiate-auth --profile $PROFILE --user-pool-id $POOL_ID --client-id "$CLIENT_ID" --auth-flow "ADMIN_USER_PASSWORD_AUTH" --auth-parameters USERNAME="$USER_ID",PASSWORD="$PASSWORD")
echo auth info: $AUTH_INFO;
REFRESH_TOKEN=`echo $AUTH_INFO | jq ".AuthenticationResult.RefreshToken"`
echo refresh token: $REFRESH_TOKEN

# credential.jsonを作成
echo "{
    \"refreshToken\": ${REFRESH_TOKEN},
    \"tokenEndpoint\": \"${TOKEN_ENDPOINT}\",
    \"clientId\": \"${CLIENT_ID}\",
    \"identityPoolId\": {
        \"system\": \"${SYSTEM_IDENTITY_POOL_ID}\"
    },
    \"authProvider\": \"cognito-idp.${REGION}.amazonaws.com/${POOL_ID}\",
    \"region\": \"${REGION}\"
}" > credential.json