# Truckwithease detention proof

## Run tests
    npm test

## Deploy to Cloud Run
    # one time: store the API key
    printf '%s' 'YOUR-LONG-RANDOM-KEY' | gcloud secrets create detention-api-key --data-file=-

    gcloud run deploy detention-proof --source . --region us-central1 \
      --set-secrets DETENTION_API_KEY=detention-api-key:latest \
      --allow-unauthenticated   # the bearer key protects /v1; drop this flag if you use IAM

The default Cloud Run service account needs the "Cloud Datastore User" role for Firestore,
and "Secret Manager Secret Accessor" for the secret.

## API (all /v1 routes need `Authorization: Bearer <key>`)
- POST /v1/stops                         dispatch: { vehicleId, stop, ctx }
- POST /v1/vehicles/:id/events           { events: [gps|door|call, ...] }  (max 500)
- GET  /v1/vehicles/:id/status           live dwell and detention minutes
- POST /v1/vehicles/:id/finalize         { invoiceNumber, billTo } -> { packet, invoice }
- GET  /v1/packets/:loadId/:stopId       stored evidence packet
- POST /v1/verify                        body = packet -> { valid }
- GET  /healthz                          no auth

## Samsara adapter (Cloud Run Job)
    gcloud run jobs create detention-samsara-poller --source . --region us-central1 \
      --command node --args src/adapters/run.js \
      --set-secrets SAMSARA_TOKEN=samsara-token:latest,DETENTION_API_KEY=detention-api-key:latest \
      --set-env-vars DETENTION_URL=https://YOUR-SERVICE-URL,DOOR_INPUT=auxInput1,VEHICLE_MAP='{"<samsara id>":"<truck id>"}'
    # then create a Cloud Scheduler job that runs it every minute.
Set DOOR_OPEN_WHEN=false if your door sensor reads false when open.
Motive: use mapMotiveLocation / createMotiveDoorMapper in src/adapters/motive.js
once you know which Motive endpoint or webhook carries your door sensor.
