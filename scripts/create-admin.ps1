$ErrorActionPreference = 'Stop'
$email = if ($env:BOOTSTRAP_ADMIN_EMAIL) { $env:BOOTSTRAP_ADMIN_EMAIL.Trim().ToLowerInvariant() } else { (Read-Host 'Owner email address').Trim().ToLowerInvariant() }

function Read-HiddenPassword {
    Write-Host -NoNewline 'Password (12-128 characters): '
    $secureValue = New-Object System.Security.SecureString
    $characterCount = 0
    while ($true) {
        $key = [Console]::ReadKey($true)
        if ($key.Key -eq [ConsoleKey]::Enter) {
            Write-Host ''
            return @{ Value = $secureValue; Length = $characterCount }
        }
        if ($key.Key -eq [ConsoleKey]::Backspace) {
            if ($characterCount -gt 0) {
                $secureValue.RemoveAt($characterCount - 1)
                $characterCount--
                Write-Host -NoNewline "`b `b"
            }
            continue
        }
        if (-not [char]::IsControl($key.KeyChar)) {
            $secureValue.AppendChar($key.KeyChar)
            $characterCount++
            Write-Host -NoNewline '*'
        }
    }
}

$passwordValid = $false
$passwordAttempts = 0
while (-not $passwordValid -and $passwordAttempts -lt 3) {
    $passwordEntry = Read-HiddenPassword
    $securePassword = $passwordEntry.Value
    $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
    try {
        $password = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
        $passwordValid = $passwordEntry.Length -ge 12 -and $passwordEntry.Length -le 128
    }
    finally {
        if ($passwordPointer -ne [IntPtr]::Zero) {
            [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
        }
        $securePassword.Dispose()
    }
    $passwordAttempts++
    if (-not $passwordValid) { Write-Host 'Password must be 12-128 characters. Try again.' }
}

if (-not $passwordValid) { throw 'Password entry was not accepted after three attempts.' }

try {
    $env:BOOTSTRAP_ADMIN_EMAIL = $email
    $env:BOOTSTRAP_ADMIN_PASSWORD = $password
    node (Join-Path $PSScriptRoot 'create-admin.js')
    if ($LASTEXITCODE -ne 0) {
        throw 'Owner account creation failed. Review the error above; the password was not saved.'
    }
}
finally {
    Remove-Item Env:BOOTSTRAP_ADMIN_EMAIL -ErrorAction SilentlyContinue
    Remove-Item Env:BOOTSTRAP_ADMIN_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:BOOTSTRAP_ADMIN_NAME -ErrorAction SilentlyContinue
    $password = $null
}