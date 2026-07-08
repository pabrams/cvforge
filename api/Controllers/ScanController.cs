using CvForge.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace CvForge.Api.Controllers;

/// <summary>Ad-hoc secret scanning — used by the clients for instant feedback as you type.</summary>
[ApiController]
[Route("api/[controller]")]
public class ScanController : ControllerBase
{
    private readonly SecretScanner _scanner;
    public ScanController(SecretScanner scanner) => _scanner = scanner;

    [HttpPost]
    public ScanResult Post(ScanRequest req)
    {
        var findings = _scanner.Scan(req.Text);
        return new ScanResult(findings, _scanner.Redact(req.Text), findings.Count == 0);
    }
}
