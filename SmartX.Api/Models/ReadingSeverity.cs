namespace SmartX.Api.Models;

/// <summary>
/// How serious a reading is once it has been checked against the threshold rules.
/// Critical readings use the priority queue, everything else uses the FIFO queue.
/// </summary>
public enum ReadingSeverity
{
    Normal = 0,
    Warning = 1,
    Critical = 2
}
