const { ClientSecretCredential } = require("@azure/identity");
const { Client } = require("@microsoft/microsoft-graph-client");
require("isomorphic-fetch");

module.exports = async function (context, req) {
    // 1. Get Credentials from Azure Settings
    const tenantId = process.env.AZURE_TENANT_ID;
    const clientId = process.env.AZURE_CLIENT_ID;
    const clientSecret = process.env.AZURE_CLIENT_SECRET;

    // 2. Check if keys exist
    if (!tenantId || !clientId || !clientSecret) {
        context.res = { status: 500, body: "Error: Missing Azure credentials in App Settings." };
        return;
    }

    try {
        // 3. Authenticate with Microsoft
        const credential = new ClientSecretCredential(tenantId, clientId, clientSecret);
        const client = Client.initWithMiddleware({
            authProvider: {
                getAccessToken: async () => {
                    const token = await credential.getToken("https://graph.microsoft.com/.default");
                    return token.token;
                }
            }
        });

        // 4. Handle the specific request
        const searchTerm = req.query.search;
        const supervisorId = req.query.supervisorId;

        if (supervisorId) {
            // CASE A: Get Direct Reports
            const response = await client.api(`/users/${supervisorId}/directReports`)
                .select("id,displayName,jobTitle,mail")
                .get();
            context.res = { body: response.value };

        } else if (searchTerm) {
            // CASE B: Search for a User
            const response = await client.api('/users')
                .filter(`startswith(displayName, '${searchTerm}')`)
                .select("id,displayName,jobTitle,mail")
                .top(5)
                .get();
            context.res = { body: response.value };

        } else {
            context.res = { status: 400, body: "Please provide a 'search' term or 'supervisorId'." };
        }

    } catch (error) {
        context.log.error(error);
        context.res = { status: 500, body: error.message };
    }
};