# SailPoint PowerShell SDK Template

A template project for the [SailPoint PowerShell SDK](https://developer.sailpoint.com/docs/tools/sdk/powershell/). It is initialized using the [SailPoint CLI](https://developer.sailpoint.com/docs/tools/cli) and provides working example scripts for common Identity Security Cloud API calls using the PowerShell SDK.

## Prerequisites

- **PowerShell 7+** ([install](https://learn.microsoft.com/en-us/powershell/scripting/install/installing-powershell))
- **SailPoint CLI** installed and configured ([installation guide](https://developer.sailpoint.com/docs/tools/cli))
- A SailPoint Identity Security Cloud tenant
- A **Personal Access Token (PAT)** with a client ID and client secret ([creating a PAT](https://developer.sailpoint.com/docs/api/authentication#personal-access-tokens))

## Getting Started

### 1. Create the project

Use the SailPoint CLI to create a new project from this template:

```powershell
sail sdk init powershell ps-example
```

### 2. Navigate into the project

```powershell
cd ps-example
```

### 3. Install dependencies

Install the SailPoint PowerShell modules from the PowerShell Gallery:

```powershell
Install-Module -Name PSSailpoint
```

If any scripts use Beta or versioned API endpoints, install the corresponding modules as well:

```powershell
Install-Module -Name PSSailpoint.Beta
Install-Module -Name PSSailpoint.V2024
```

> **Tip:** If you are prompted to trust the repository, select **Yes** or run with `-Force` to skip the prompt.

### 4. Configure the SDK

The SDK needs credentials to authenticate with your SailPoint tenant. Generate a `config.json` file using the CLI:

```powershell
sail sdk init config
```

If you have multiple environments configured in the CLI, specify which one to use:

```powershell
sail sdk init config --env devrel
```

This creates a `config.json` in the project directory:

```json
{
  "ClientId": "your-client-id",
  "ClientSecret": "your-client-secret",
  "BaseURL": "https://[tenant].api.identitynow.com"
}
```

You can also use environment variables (`SAIL_BASE_URL`, `SAIL_CLIENT_ID`, `SAIL_CLIENT_SECRET`) instead of a config file.

> **Tip:** Add `config.json` to your `.gitignore` so credentials are not committed to version control.

### 5. Run the project

Each `.ps1` file is a standalone example. Before running, update any hardcoded IDs, filters, or values to match your tenant:

```powershell
./sdk.ps1
```

## What's Included

| Script                 | Description                                                  |
| ---------------------- | ------------------------------------------------------------ |
| `sdk.ps1`              | List accounts with filtering and pagination parameters       |
| `search.ps1`           | Search identities using the Search API                       |
| `paginate.ps1`         | Paginate through search results with `Invoke-PaginateSearch` |
| `paginateAccounts.ps1` | Paginate through accounts with `Invoke-Paginate`             |
| `patchEntitlement.ps1` | Update an entitlement using a JSON Patch operation           |
| `transform.ps1`        | Create a lookup transform                                    |

## Customization

- **Swap API calls** — Replace the example cmdlets with any from the [PowerShell SDK reference](https://developer.sailpoint.com/docs/tools/sdk/powershell/).
- **Update parameters** — Change filters, IDs, and query strings to match your environment.
- **Add error handling** — Extend the `try/catch` blocks with logging or retry logic as needed.

## Resources

- [PowerShell SDK Documentation](https://developer.sailpoint.com/docs/tools/sdk/powershell/)
- [PowerShell SDK Getting Started Guide](https://developer.sailpoint.com/docs/tools/sdk/powershell/#configure-the-sdk)
- [SailPoint CLI Documentation](https://developer.sailpoint.com/docs/tools/cli)
- [Identity Security Cloud API Reference](https://developer.sailpoint.com/docs/api/)
- [PowerShell Gallery — PSSailpoint](https://www.powershellgallery.com/packages/PSSailpoint)
- [SailPoint Developer Community](https://developer.sailpoint.com/discuss)
