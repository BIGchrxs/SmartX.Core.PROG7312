# Build with the full SDK, then ship on the smaller runtime image. The SDK and the source
# never reach the final image, so what runs in production is only the compiled application.

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# The project file is copied on its own first. Docker caches each step, so a restore is only
# repeated when the dependencies change, not every time a line of C# changes.
COPY SmartX.Api.csproj .
RUN dotnet restore

COPY . .
RUN dotnet publish -c Release -o /app --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

COPY --from=build /app .

# Uploaded media lands here. Compose mounts a volume over it so files survive a rebuild, and the
# folder is owned by the unprivileged user the container runs as.
RUN mkdir -p /app/uploads && chown -R 1654:1654 /app/uploads
USER 1654

# Inside the container the API listens on 8080. Compose publishes it on 5067, so every address
# in the README keeps working whether the project is run with Docker or with dotnet run.
ENV ASPNETCORE_URLS=http://+:8080
EXPOSE 8080

ENTRYPOINT ["dotnet", "SmartX.Api.dll"]
