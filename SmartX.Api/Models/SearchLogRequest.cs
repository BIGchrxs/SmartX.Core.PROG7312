namespace SmartX.Api.Models;

/// <summary>Request body for POST /activity/search. The dashboard sends this once a search has settled.</summary>
public sealed record SearchLogRequest(string Term);
