Import-Module PSSailpoint

$Json = @"
{
	"indices": [
		"identities"
	],
	"query": {
		"query": "*",
		"fields": [
		"name"
		]
	}
	}
"@

$Search = ConvertFrom-JsonToSearch -Json $Json

try {
    Search-PostV1 -Search $Search
} catch {
    Write-Host ("Exception occurred when calling Search-PostV1: {0}" -f $_.ErrorDetails)
    Write-Host ("Response headers: {0}" -f $_.Exception.Response.Headers)
}