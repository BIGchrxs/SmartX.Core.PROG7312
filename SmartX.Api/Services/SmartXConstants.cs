namespace SmartX.Api.Services;

/// <summary>
/// Timing values shared by the API services. The dashboard's SensorCard uses the same
/// stale and critical limits, so the API and the UI always agree on what "silent" means.
/// </summary>
public static class SmartXConstants
{
    // Seconds without a reading before a device counts as slow to report.
    public const int StaleAfterSeconds = 15;

    // Seconds without a reading before a device counts as disconnected.
    public const int CriticalAfterSeconds = 45;

    // How often the disconnect monitor looks for silent devices.
    public const int DisconnectCheckSeconds = 5;

    // Newest readings kept per device in the sorted history.
    public const int HistoryCapPerDevice = 500;
}
