Import-Module PSSailpoint

# NOTE: the Accounts API only supports these filter operators:
#   id: eq, in | identityId: eq | name: eq, in | nativeIdentity: eq, in | sourceId: eq, in | uncorrelated: eq
# "co" (contains) is NOT valid for name, so filter by sourceId instead.
$Parameters = @{
    "Filters" = 'sourceId eq "f4e73766efdf4dc6acdeed179606d694"'
}

# Accounts List
try {

    Invoke-Paginate "Get-AccountsV1" -Increment 250 -Limit 1000 -InitialOffset 0 -Parameters $Parameters

} catch {
    Write-Host ("Exception occurred when calling Invoke-Paginate Get-AccountsV1: {0}" -f $_.ErrorDetails)
    Write-Host ("Response headers: {0}" -f $_.Exception.Response.Headers)
}