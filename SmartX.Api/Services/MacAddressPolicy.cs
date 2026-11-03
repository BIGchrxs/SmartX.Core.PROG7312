using System.Globalization;
using System.Text.RegularExpressions;

namespace SmartX.Api.Services;

/// <summary>
/// Validates and generates the hardware addresses the mesh nodes are identified by. Real ESP32
/// chips carry an address inside Espressif's registered block, so a generated one keeps that same
/// 24:6F:28 prefix and fills the last three octets from the device ID. Because it is derived from
/// the ID rather than from a random draw, a device gets the same address every time the gateway starts.
/// </summary>
public static class MacAddressPolicy
{
    // The block of addresses the Espressif chips in this deployment are issued from.
    public const string EspressifPrefix = "24:6F:28";

    private static readonly Regex Pattern = new(@"^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$", RegexOptions.Compiled);

    // True when the text is six pairs of hex digits separated by colons.
    public static bool IsValid(string? mac) => !string.IsNullOrWhiteSpace(mac) && Pattern.IsMatch(mac);
    //-----------//

    // Puts a valid address into upper case with colons, so two spellings of one address never split a lookup.
    public static string Normalise(string mac) => mac.Trim().ToUpperInvariant();
    //-----------//

    /// <summary>
    /// Builds a stable address for a device that did not bring one. The device ID is hashed with
    /// FNV-1a, a small non cryptographic hash, and the low three bytes become the last three octets.
    /// </summary>
    public static string Generate(string deviceId)
    {
        unchecked
        {
            const uint offsetBasis = 2166136261;
            const uint prime = 16777619;

            var hash = offsetBasis;
            foreach (var c in deviceId.ToUpperInvariant())
            {
                hash ^= c;
                hash *= prime;
            }

            var a = (byte)(hash >> 16);
            var b = (byte)(hash >> 8);
            var c2 = (byte)hash;

            return string.Format(
                CultureInfo.InvariantCulture,
                "{0}:{1:X2}:{2:X2}:{3:X2}",
                EspressifPrefix,
                a,
                b,
                c2);
        }
    }
    //-----------//
}
