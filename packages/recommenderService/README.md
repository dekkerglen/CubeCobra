# CubeCobra Recommender Service

A dedicated microservice for machine learning recommendations in CubeCobra.

## Overview

The Recommender Service is a standalone Node.js/Express microservice that handles all ML-powered features in CubeCobra:

- Cube card recommendations
- Deck building suggestions
- Draft pick recommendations
- Card encoding and similarity

## Architecture

This service:

- Runs independently from the main CubeCobra server
- Loads TensorFlow.js models on startup
- Provides REST API endpoints for ML predictions
- Uses smaller instance sizes (t3.small) compared to main server
- Deployed at `ml.cubecobra.com` in production

## Development

### Setup

1. Copy `.env.example` to `.env` and configure
2. Ensure ML models are downloaded: `npm run download-data-files` from repo root
3. Install dependencies: `npm install`
4. Run in dev mode: `npm run dev`

The service runs on port 5002 by default.

### Environment Variables

- `PORT` - Server port (default: 5002)
- `NODE_ENV` - Environment (development/production)
- `DATA_BUCKET` - S3 bucket for model files
- `AWS_REGION` - AWS region for S3 access
- `LOG_GROUP_NAME` - CloudWatch log group (production only)

### API Endpoints

#### POST /recommend

Recommend cards to add or cut from a cube.

**Request:**

```json
{
  "oracles": ["oracle-id-1", "oracle-id-2", ...]
}
```

**Response:**

```json
{
  "success": true,
  "adds": [{"oracle": "...", "rating": 0.95}, ...],
  "cuts": [{"oracle": "...", "rating": 0.02}, ...]
}
```

#### POST /build

Get card ratings for deck building.

**Request:**

```json
{
  "oracles": ["oracle-id-1", "oracle-id-2", ...]
}
```

**Response:**

```json
{
  "success": true,
  "cards": [{"oracle": "...", "rating": 0.92}, ...]
}
```

#### POST /draft

Get pick recommendations for draft.

**Request:**

```json
{
  "pack": ["oracle-id-1", "oracle-id-2", ...],
  "pool": ["oracle-id-3", "oracle-id-4", ...]
}
```

**Response:**

```json
{
  "success": true,
  "cards": [{"oracle": "...", "rating": 0.88}, ...]
}
```

#### POST /encode

Encode card oracles to ML embeddings.

**Request:**

```json
{
  "oracles": ["oracle-id-1", "oracle-id-2", ...]
}
```

**Response:**

```json
{
  "success": true,
  "encoding": [0.12, 0.45, -0.33, ...]
}
```

## Deployment

### AWS Infrastructure

The service deploys to AWS Elastic Beanstalk with:

- Instance type: t3.small
- Fleet size: 3 instances (production), 1 instance (beta)
- Domain: ml.cubecobra.com (production), ml-beta.cubecobra.com (beta)
- Health check: GET /healthcheck

### Building

```bash
npm run build
```

This compiles TypeScript to the `dist/` directory.

### Production

The service is deployed alongside the main CubeCobra stack via CDK. See `packages/cdk/lib/recommender-service.ts` for infrastructure details.

## Testing

```bash
npm test
```

## Memory Requirements

The ML models require approximately 1-2GB RAM when loaded. The t3.small instances (2GB RAM) are sufficient for the recommender service.
