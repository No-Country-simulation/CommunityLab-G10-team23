# Mixed input examples

These files are synthetic request bodies for `POST /api/v1/pipeline/process` or `POST /api/v1/pipeline/jobs`. Each batch mixes useful community interactions with an off-topic message so the pipeline can be tried with varied input.

- `small-mixed-batch.json`: 3 interactions for a quick check.
- `medium-mixed-batch.json`: 6 interactions for a typical batch.
- `demo-mixed-batch.json`: 10 interactions for a longer demonstration.

The payloads use the external request shape. Do not add `id` or `timestamp`; the backend creates those fields during processing. Names and message content are fictional. The examples are intended for manual demos and API exploration, not as canonical automated-test fixtures.