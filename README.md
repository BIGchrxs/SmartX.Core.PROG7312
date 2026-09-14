## Smart-X Sensor Data Ingestion and Telemetry Gateway

Smart-X is a hybrid IoT ingestion gateway for **Studio HQ**, an interior design and architecture studio. It monitors the building systems behind the studio.
Environmental conditions, power draw, and automated actuators across four zones: **Showroom Floor**, **Material Storage**, **Workshop**, and **IT Closet**.

This is Part 1 of the Smart-X PoE: the data ingestion pipeline and the developer-facing dashboard for registering sensors and watching their status live.

------

## Repository structure

This repo contains three separate projects:
Project: Purpose 
    -SmartX.Core.PROG7312/ : A standalone console app that proves the four core C# requirements in isolation: generics (TelemetryPacket()), operator overloading (SensorReading), recursion (DeviceNode), and jagged arrays feeding a List<> (TelemetryBuffer()). Not part of the submitted application, a scaffolding/proof step.

    - SmartX.Api/ : The real backend - an ASP.NET Core Minimal API handling sensor registration, telemetry ingestion, and file upload.

    - smart-x-dashboard/ : The real frontend - a React + TypeScript single-page app that is the actual gateway UI. 

------

## Architecture

Browser 
   │
smart-x-dashboard  (React + Vite, http://localhost:5173)
   │  fetch("/api/...")
   |
Vite dev server proxy  (forwards /api/* → :5067, strips the /api prefix)
   │
SmartX.Api  (ASP.NET Core Minimal API, http://localhost:5067)
   │
SensorRegistry  (in-memory store - resets whenever the API restarts)

The frontend and backend are two separate running processes that must both be running at the same time. Nothing is persisted to a database, all sensor and telemetry data lives in memory in the API process and is lost when it stops.

------

## Prerequisites

- **.NET 10 SDK**
- **Node.js 18+** and npm

## Setup & running

### 1. Console demo (optional)

Proves the four core C# concepts work correctly before touching the real project. Not required to run the actual application.

cd SmartX.Core.PROG7312
dotnet run

### 2. Backend API (required)

cd SmartX.Api
dotnet restore
dotnet run

Wait for `Now listening on: http://localhost:5067`. Leave this terminal running.

### 3. Frontend dashboard (required)

(In a **separate terminal**)
cd smart-x-dashboard
npm install
npm run dev

Wait for `VITE ready`, then open **http://localhost:5173** in a browser.
Both halves must stay running for the app to work, the frontend has no data of its own and gets everything from the API.

----

## Using the app

1. Open `http://localhost:5173`. You'll land on the Smart-X gateway, with three architectural pillars, only **Sensor Data Ingestion & Telemetry** is active for this part, the other two are disabled.
2. Click into it. Register a sensor with a device ID, zone, category, and value type.
3. Use **Send reading** to submit a telemetry value for that sensor. Its status dot goes from grey --> green (live) and ages to orange, then red, the longer it goes without a new reading, this is the dashboard's live engagement strategy from the Task 1 research.
4. Use **Attach a file** to upload a config file, photo, or log against a sensor.

----

## API reference

| Method | Route | Purpose |

| GET  | /sensors            | List every registered sensor                                                                      |
| POST | /sensors            | Register a sensor - { deviceId, zone, category, valueType }                                       |
| GET  | /sensors/{id}       | Look up a single sensor                                                                           |
| POST | /telemetry          | Ingest a reading - { deviceId, value }                                                            |
| GET  | /telemetry/flushed  | Readings that have completed a full batch and flushed from the jagged-array buffer into List<T>   |
| POST | /sensors/{id}/media | Upload a file for a sensor (multipart/form-data, field name file)                                 |

----

### Valid values

- **Zone**: `Showroom Floor`, `Material Storage`, `Workshop`, `IT Closet` (validated recursively against the `Studio HQ` deployment tree)
- **Category**: `Environmental`, `Power`, `Actuator`
- **Value type**: `Float`, `Int`, `Bool`

----

## Tech stack

- **Backend**: C# / .NET 10, ASP.NET Core Minimal API
- **Frontend**: React 18, TypeScript, Vite, plain CSS (no UI framework)
- **Data storage**: in-memory (`SensorRegistry` singleton) - no database in Part 1

ST10440190
Christopher Graham 
Emeris College Newlands