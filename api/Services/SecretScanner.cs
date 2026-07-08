using System.Text;
using System.Text.RegularExpressions;

namespace CvForge.Api.Services;

public record SecretFinding(string Rule, string Preview, int Index, int Length);

/// <summary>
/// Scans free text for likely credentials before it can flow into a public artifact.
/// Combines named patterns (AWS keys, JWTs, generic KEY=... assignments, private-key headers)
/// with a Shannon-entropy check for high-entropy tokens the patterns miss.
/// </summary>
public class SecretScanner
{
    private static readonly (string Rule, Regex Rx)[] Patterns =
    {
        ("aws-access-key",   new Regex(@"\bAKIA[0-9A-Z]{16}\b", RegexOptions.Compiled)),
        ("openai-key",       new Regex(@"\bsk-[A-Za-z0-9]{20,}\b", RegexOptions.Compiled)),
        ("github-token",     new Regex(@"\bgh[pousr]_[A-Za-z0-9]{20,}\b", RegexOptions.Compiled)),
        ("slack-token",      new Regex(@"\bxox[baprs]-[A-Za-z0-9-]{10,}\b", RegexOptions.Compiled)),
        ("jwt",              new Regex(@"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b", RegexOptions.Compiled)),
        ("private-key",      new Regex(@"-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----", RegexOptions.Compiled)),
        // Generic assignment: FOO_API_KEY = "value" / TOKEN: value / SECRET=value
        ("assigned-secret",  new Regex(@"(?i)\b[A-Z0-9_]*(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD|PASSWD|ACCESS[_-]?KEY)\b\s*[:=]\s*[""']?([A-Za-z0-9/+_\-\.]{8,})", RegexOptions.Compiled)),
    };

    public IReadOnlyList<SecretFinding> Scan(string? text)
    {
        var findings = new List<SecretFinding>();
        if (string.IsNullOrEmpty(text)) return findings;

        foreach (var (rule, rx) in Patterns)
            foreach (Match m in rx.Matches(text))
                findings.Add(new SecretFinding(rule, Mask(m.Value), m.Index, m.Length));

        // Entropy sweep: flag long high-entropy tokens the named rules didn't already cover.
        foreach (Match m in Regex.Matches(text, @"[A-Za-z0-9/+_\-]{20,}"))
        {
            if (findings.Any(f => m.Index >= f.Index && m.Index < f.Index + f.Length)) continue;
            if (ShannonEntropy(m.Value) >= 3.5)
                findings.Add(new SecretFinding("high-entropy", Mask(m.Value), m.Index, m.Length));
        }

        return findings.OrderBy(f => f.Index).ToList();
    }

    public bool HasSecrets(string? text) => Scan(text).Count > 0;

    /// <summary>Replace every detected secret span with [REDACTED], right-to-left to keep indices valid.</summary>
    public string Redact(string? text)
    {
        if (string.IsNullOrEmpty(text)) return text ?? "";
        var sb = new StringBuilder(text);
        foreach (var f in Scan(text).OrderByDescending(f => f.Index))
        {
            sb.Remove(f.Index, f.Length);
            sb.Insert(f.Index, "[REDACTED]");
        }
        return sb.ToString();
    }

    private static string Mask(string s) =>
        s.Length <= 6 ? new string('*', s.Length) : s[..3] + new string('*', s.Length - 6) + s[^3..];

    private static double ShannonEntropy(string s)
    {
        var counts = s.GroupBy(c => c).ToDictionary(g => g.Key, g => (double)g.Count());
        double len = s.Length, entropy = 0;
        foreach (var c in counts.Values)
        {
            double p = c / len;
            entropy -= p * Math.Log2(p);
        }
        return entropy;
    }
}
