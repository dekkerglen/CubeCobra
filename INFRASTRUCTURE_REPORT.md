# CubeCobra Infrastructure Report

## Executive Summary

CubeCobra is a Magic: The Gathering cube management platform built on AWS using a modern serverless-first architecture. The infrastructure is defined using AWS CDK (Cloud Development Kit) in TypeScript, enabling Infrastructure-as-Code best practices. The platform consists of a multi-tier web application with machine learning capabilities, scheduled background jobs, and a robust CI/CD pipeline.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Component Inventory](#2-component-inventory)
3. [Component Roles and Capabilities](#3-component-roles-and-capabilities)
4. [Data Flow Analysis](#4-data-flow-analysis)
5. [AWS Pricing Analysis](#5-aws-pricing-analysis)
6. [Cost Savings Plan](#6-cost-savings-plan)
7. [Recommendations Summary](#7-recommendations-summary)

---

## 1. Architecture Overview

### High-Level Architecture Diagram

```
                                    ┌─────────────────────────────────────────────────────────────┐
                                    │                        AWS Cloud                             │
                                    │                       (us-east-2)                           │
┌──────────┐                        │  ┌─────────────────┐                                        │
│  Users   │───HTTPS───────────────▶│  │   Route 53      │                                        │
│(Internet)│                        │  │   DNS           │                                        │
└──────────┘                        │  └────────┬────────┘                                        │
                                    │           │                                                  │
                                    │           ▼                                                  │
                                    │  ┌─────────────────┐      ┌─────────────────┐              │
                                    │  │  Application    │      │   ML Service    │              │
                                    │  │  Load Balancer  │      │  Load Balancer  │              │
                                    │  │  (ALB - HTTPS)  │      │  (ALB - HTTPS)  │              │
                                    │  └────────┬────────┘      └────────┬────────┘              │
                                    │           │                        │                        │
                                    │           ▼                        ▼                        │
                                    │  ┌─────────────────┐      ┌─────────────────┐              │
                                    │  │ Elastic         │      │ Elastic         │              │
                                    │  │ Beanstalk       │◀────▶│ Beanstalk       │              │
                                    │  │ (Main Server)   │      │ (Recommender)   │              │
                                    │  │ 3x t3.large     │      │ 2x t3.medium    │              │
                                    │  └────────┬────────┘      └────────┬────────┘              │
                                    │           │                        │                        │
                                    │           ▼                        │                        │
                                    │  ┌─────────────────────────────────┴──────────────────┐    │
                                    │  │                    AWS Services                     │    │
                                    │  │  ┌───────────┐  ┌───────────┐  ┌───────────┐      │    │
                                    │  │  │ DynamoDB  │  │    S3     │  │    SES    │      │    │
                                    │  │  │(Single    │  │(Data &    │  │(Email)    │      │    │
                                    │  │  │ Table)    │  │ Assets)   │  │           │      │    │
                                    │  │  └───────────┘  └───────────┘  └───────────┘      │    │
                                    │  └────────────────────────────────────────────────────┘    │
                                    │                                                              │
                                    │  ┌─────────────────────────────────────────────────────┐    │
                                    │  │              Scheduled Processing Layer              │    │
                                    │  │  ┌──────────────┐        ┌──────────────┐           │    │
                                    │  │  │   Lambda     │        │   Lambda     │           │    │
                                    │  │  │ (Daily Jobs) │        │(Card Monitor)│           │    │
                                    │  │  │  1024 MB     │        │   512 MB     │           │    │
                                    │  │  └──────────────┘        └──────┬───────┘           │    │
                                    │  │                                  │                   │    │
                                    │  │                                  ▼                   │    │
                                    │  │                          ┌──────────────┐           │    │
                                    │  │                          │  ECS Fargate │           │    │
                                    │  │                          │ (Jobs Tasks) │           │    │
                                    │  │                          │ 4 vCPU/30 GB │           │    │
                                    │  │                          └──────────────┘           │    │
                                    │  └─────────────────────────────────────────────────────┘    │
                                    └─────────────────────────────────────────────────────────────┘
```

### Environment Configuration

| Environment | Account ID | Region | Domain | Main Fleet | ML Fleet | DynamoDB Prefix |
|-------------|------------|--------|--------|------------|----------|-----------------|
| Local | 000000000000 | us-east-1 | localhost | 1 | 1 | LOCAL |
| Development | 816705121310 | us-east-2 | cubecobradev.com | 1 | 1 | DEV |
| Beta | 816705121310 | us-east-2 | cubecobradev.com | 1 | 1 | BETA |
| **Production** | 816705121310 | us-east-2 | cubecobra.com | 3 | 2 | PROD |

---

## 2. Component Inventory

### Compute Resources

| Component | Service | Instance Type | Count (Prod) | Configuration |
|-----------|---------|---------------|--------------|---------------|
| Main Server | Elastic Beanstalk | t3.large | 3-4 | 2 vCPU, 8 GB RAM |
| ML Service | Elastic Beanstalk | t3.medium | 2-3 | 2 vCPU, 4 GB RAM |
| Jobs Container | ECS Fargate | N/A | On-demand | 4 vCPU, 30 GB RAM |
| Daily Jobs Lambda | Lambda | N/A | Event-driven | 1024 MB, 15 min timeout |
| Card Monitor Lambda | Lambda | N/A | Every 5 min | 512 MB, 5 min timeout |

### Storage Resources

| Component | Service | Configuration | Purpose |
|-----------|---------|---------------|---------|
| Main Database | DynamoDB | Pay-per-request, 4 GSIs | User data, cubes, drafts, content |
| Sessions Table | DynamoDB | Pay-per-request | Express session storage |
| Data Bucket | S3 | Standard | Cube cards, drafts, ML models, card DB |
| App Bucket | S3 | Standard | Build artifacts, Lambda code |
| Public Bucket | S3 | Standard | Public exports (PROD only) |

### Networking Resources

| Component | Service | Configuration |
|-----------|---------|---------------|
| Main ALB | Application Load Balancer | HTTPS (443), with stickiness |
| ML ALB | Application Load Balancer | HTTPS (443), with stickiness |
| DNS | Route 53 | cubecobra.com, ml.cubecobra.com |
| SSL Certificates | ACM | Wildcard for domain + subdomains |

### CI/CD Resources

| Component | Service | Configuration |
|-----------|---------|---------------|
| Pipeline | CodePipeline | 4 stages, GitHub integration |
| Beta Deploy | CodeBuild | MEDIUM compute, privileged mode |
| Prod Deploy | CodeBuild | MEDIUM compute, privileged mode |
| Integration Tests | CodeBuild | LARGE compute |
| Container Registry | ECR | 2 repositories (main, jobs) |

---

## 3. Component Roles and Capabilities

### 3.1 Main Web Server (Elastic Beanstalk)

**Location**: `packages/server/`

**Role**: Primary application server handling all user-facing requests

**Capabilities**:
- Express.js web server (Node.js 20 on Amazon Linux 2023)
- Server-side rendering with Pug templates
- RESTful API endpoints for all CRUD operations
- Session management via DynamoDB
- User authentication (Passport.js with local strategy)
- Patreon OAuth integration for patronage
- Stripe integration for merchandise
- CAPTCHA protection for bot prevention
- Real-time cube management (add/remove/edit cards)
- Draft creation and management
- Content management (articles, videos, podcasts)
- Admin dashboard and moderation tools

**Key Endpoints**:
```
/cube/*        - Cube management (20+ endpoints)
/draft/*       - Draft sessions
/user/*        - User accounts and profiles
/admin/*       - Administrative functions
/patreon/*     - Patreon OAuth flow
/content/*     - Content management
/tool/*        - Utility endpoints
/api/*         - General API endpoints
```

**Resource Allocation (Production)**:
- Instance type: t3.large (2 vCPU, 8 GB RAM)
- Fleet size: 3-4 instances
- Auto-scaling: Min 3, Max 4
- Health check: `/healthcheck` every 30 seconds

### 3.2 ML Recommender Service (Elastic Beanstalk)

**Location**: `packages/recommenderService/`

**Role**: Machine learning service for card recommendations and draft predictions

**Capabilities**:
- TensorFlow.js with Node.js backend
- Card oracle text encoding to embeddings
- Cube card recommendations (adds/cuts)
- Deck building from card pool
- Draft pick predictions
- Model loading from S3 on startup

**Endpoints**:
```
GET  /healthcheck     - Health status
POST /encode          - Encode card oracles to embeddings
POST /recommend       - Get card recommendations for cube
POST /build           - Build optimal deck from card pool
POST /draft           - Predict best draft picks
```

**Resource Allocation (Production)**:
- Instance type: t3.medium (2 vCPU, 4 GB RAM)
- Fleet size: 2-3 instances
- Auto-scaling: Min 2, Max 3

### 3.3 Daily Jobs Lambda

**Location**: `packages/dailyJobsLambda/`

**Role**: Lightweight scheduled tasks that run daily

**Capabilities**:
- Sync podcast episodes from RSS feeds
- Rotate daily Pick-1-Pack-1 challenges
- Rotate featured cubes queue (weekly on Sundays)

**Configuration**:
- Runtime: Node.js 22.x
- Memory: 1024 MB
- Timeout: 15 minutes
- Schedule: Daily at midnight UTC

**Cost Efficiency**: Uses Lambda instead of always-on compute for periodic tasks that complete quickly.

### 3.4 Card Update Monitor Lambda

**Location**: `packages/cardUpdateMonitorLambda/`

**Role**: Monitor external APIs and coordinate background job execution

**Capabilities**:
- Monitor Scryfall API for card database updates
- Check file size changes to detect updates
- Create task tracking records in DynamoDB
- Start ECS Fargate tasks for heavy processing
- Monitor task health and completion status
- Handle task timeout detection (1-hour max)

**Configuration**:
- Runtime: Node.js 22.x
- Memory: 512 MB
- Timeout: 5 minutes
- Schedule: Every 5 minutes via EventBridge

**Task Types Monitored**:
- Card updates (from Scryfall)
- Metadata dictionary updates
- Data exports
- Database migrations

### 3.5 Jobs ECS Task (Fargate)

**Location**: `packages/jobs/`

**Role**: Heavy-duty data processing jobs

**Capabilities**:
- Update card database from Scryfall bulk data
- Update card combo database from Commander Spellbook
- Update metadata dictionaries (card correlations, synergies)
- Update cube history analytics
- Update draft history and ELO ratings
- Calculate card pick/pass rates
- Generate cube analytics
- Export data to public S3 bucket

**Configuration**:
- CPU: 4 vCPU (4096 units)
- Memory: 30 GB (30720 MiB)
- Node.js heap: 28 GB (`--max_old_space_size=28672`)
- Launch type: Fargate
- Networking: Public subnets with public IP (default VPC)

**Available Commands**:
```bash
npm run update-all        # Full update pipeline
npm run update-cards      # Scryfall card data
npm run update-combos     # Commander Spellbook data
npm run update-metadata-dict  # Card correlations
npm run update-cube-history   # Cube analytics
npm run update-draft-history  # Draft ELO and stats
```

### 3.6 DynamoDB (Single-Table Design)

**Role**: Primary database for all application data

**Table Structure**:
- Table Name: `{PREFIX}_CUBECOBRA` (e.g., `PROD_CUBECOBRA`)
- Partition Key: `PK` (String)
- Sort Key: `SK` (String)
- Billing: Pay-per-request (on-demand)

**Global Secondary Indexes**:
| Index | Partition Key | Sort Key | Purpose |
|-------|--------------|----------|---------|
| GSI1 | GSI1PK | GSI1SK | Owner queries, follower counts |
| GSI2 | GSI2PK | GSI2SK | Alphabetical sorting |
| GSI3 | GSI3PK | GSI3SK | Sharding, card count queries |
| GSI4 | GSI4PK | GSI4SK | Date-based queries |

**Entity Types**:
- Users (`USER#{id}`)
- Cubes (`CUBE#{id}`)
- Drafts (`DRAFT#{id}`)
- Blogs (`BLOG#{id}`)
- Comments (`COMMENT#{id}`)
- Articles/Videos/Podcasts (`ARTICLE#{id}`, etc.)
- Notifications, Feeds, etc.
- Hash rows for search (`HASH#CUBE#{id}`)

### 3.7 S3 Storage

**Data Bucket** (`cubecobra-data-production`):
| Path | Content | Access Pattern |
|------|---------|----------------|
| `cube/{id}.json` | Cube card lists (up to 10K cards) | Read on cube view, write on commit |
| `cube_analytic/{id}.json` | Cube statistics | Read on analytics page |
| `cardlist/{id}.json` | Draft card pools | Read/write during drafts |
| `seats/{id}.json` | Draft seat data | Read/write during drafts |
| `cube_draft_history/{id}` | Draft history analytics | Write by jobs |
| `cards/manifest.json` | Card DB manifest | Read by server startup |
| `private/carddict.json` | Full card database (~100MB) | Read by server startup |
| `private/metadatadict.json` | Card metadata | Read by server startup |
| `model/*` | ML model files | Read by ML service |
| `content/{id}.json` | Article/video bodies | Read on content pages |

**App Bucket** (`cubecobra`):
| Path | Content |
|------|---------|
| `builds/{version}.zip` | Server deployment artifacts |
| `builds/recommender-{version}.zip` | ML service artifacts |
| `dailyJobsLambda/{version}.zip` | Lambda code packages |
| `cardUpdateMonitorLambda/{version}.zip` | Lambda code packages |

### 3.8 Application Load Balancers

**Main ALB**:
- HTTPS listener on port 443
- SSL termination with ACM certificate
- Sticky sessions enabled
- Health check: `/healthcheck` (30s interval, 5s timeout)
- Target: Elastic Beanstalk instances

**ML Service ALB**:
- HTTPS listener on port 443
- Same SSL certificate
- Sticky sessions enabled
- Health check: `/healthcheck`
- Target: ML Elastic Beanstalk instances

### 3.9 CI/CD Pipeline

**Pipeline Stages**:

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        CubeCobra Deployment Pipeline                      │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  Stage 1: Source                                                          │
│  ├── GitHub (CodeStar Connections)                                        │
│  └── Trigger: Push to master branch                                       │
│                                                                           │
│  Stage 2: Deploy Beta                                                     │
│  ├── npm install && npm run ci-build                                      │
│  ├── Publish server artifact to S3                                        │
│  ├── Publish recommender artifact to S3                                   │
│  ├── Build and publish Lambda functions                                   │
│  ├── CDK deploy to beta environment                                       │
│  └── Build and push Docker image to ECR                                   │
│                                                                           │
│  Stage 3: Integration Tests                                               │
│  ├── Playwright tests against beta                                        │
│  └── Chromium browser tests                                               │
│                                                                           │
│  Stage 4: Deploy Production                                               │
│  ├── Same build process as beta                                           │
│  └── CDK deploy to production environment                                 │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Data Flow Analysis

### 4.1 User Request Flow (Read Path)

```
User Browser
     │
     │ HTTPS Request
     ▼
Route 53 DNS
     │
     │ A Record Alias
     ▼
Application Load Balancer (ALB)
     │
     │ HTTPS (443) → HTTP (8080)
     │ SSL Termination
     ▼
Elastic Beanstalk Instance (t3.large)
     │
     ├──────────────────────────────────┐
     │                                  │
     ▼                                  ▼
DynamoDB                              S3
(Metadata queries)            (Large objects: cards, drafts)
     │                                  │
     └──────────────────────────────────┘
                    │
                    ▼
              Response to User
```

**Data Transfer Points**:
1. **Internet → ALB**: Public internet ingress (free)
2. **ALB → EC2**: Within AZ (free) or cross-AZ ($0.01/GB)
3. **EC2 → DynamoDB**: Within region, same VPC ($0.00/GB for interface endpoints or ~$0.01/GB for public endpoints)
4. **EC2 → S3**: Within region ($0.00/GB with VPC Gateway Endpoint)
5. **EC2 → Internet**: Response egress ($0.09/GB first 10TB)

### 4.2 Cube Card Recommendation Flow (ML Service)

```
User Browser
     │
     │ Request card recommendations
     ▼
Main Server (EC2)
     │
     │ Internal HTTPS call to ml.cubecobra.com
     ▼
ML ALB
     │
     ▼
ML Service (EC2)
     │
     ├── Load TensorFlow model (cached in memory)
     ├── Encode card oracles
     └── Generate recommendations
     │
     │ JSON response
     ▼
Main Server
     │
     │ Combined response
     ▼
User Browser
```

**Data Transfer Points**:
1. **Main EC2 → ML ALB**: Cross-service call via public internet
   - **COST ISSUE**: This goes through public internet even though both services are in the same VPC
   - Each recommendation call involves ~1-10KB request, ~1-50KB response
   - Estimated: **$0.09/GB egress + $0.09/GB ingress = $0.18/GB**

### 4.3 Background Job Flow (Card Updates)

```
EventBridge (every 5 minutes)
     │
     │ Invoke Lambda
     ▼
Card Update Monitor Lambda
     │
     ├── Check Scryfall API (external HTTPS)
     ├── Compare with S3 manifest
     │
     │ If update detected:
     ▼
DynamoDB
     │
     │ Create task record
     ▼
ECS Fargate Task
     │
     ├── Download card data from Scryfall (~500MB)
     ├── Process and transform data
     ├── Write to S3 (~100MB compressed)
     └── Update DynamoDB metadata
     │
     ▼
Task Complete
```

**Data Transfer Points**:
1. **Lambda → Internet (Scryfall)**: Egress ($0.09/GB)
2. **Fargate → Internet (Scryfall)**: ~500MB download per update
3. **Fargate → S3**: Free with VPC Gateway Endpoint
4. **Fargate → DynamoDB**: Regional, minimal cost

### 4.4 Session Management Flow

```
User Login
     │
     ▼
Main Server
     │
     ├── Authenticate via Passport.js
     ├── Create session in DynamoDB (SESSIONS table)
     └── Set session cookie
     │
     ▼
Subsequent Requests
     │
     ├── Read session from DynamoDB
     ├── Touch session every 5 minutes
     └── Session TTL: 30 days
```

**DynamoDB Read/Write Patterns**:
- Session read: ~1 RCU per request
- Session touch: ~1 WCU every 5 minutes per active user
- Sessions table size depends on active users

### 4.5 Draft Data Flow

```
Create Draft
     │
     ▼
Main Server
     │
     ├── Generate draft packs (card selection)
     ├── Write draft metadata to DynamoDB
     ├── Write card pool to S3 (cardlist/{id}.json)
     └── Initialize seats in S3 (seats/{id}.json)
     │
     ▼
During Draft (per pick)
     │
     ├── Read current state from DynamoDB
     ├── Update pick in memory
     └── Write updated state
     │
     ▼
Complete Draft
     │
     ├── Update DynamoDB status
     ├── Write final decks to S3
     └── Trigger analytics update (async)
```

---

## 5. AWS Pricing Analysis

### 5.1 Elastic Beanstalk / EC2 Costs

**Main Server (Production)**:
| Resource | Specification | Monthly Cost (On-Demand) |
|----------|---------------|-------------------------|
| t3.large instances | 3 instances × 730 hours | $182.04 (3 × $0.0832/hr × 730) |
| EBS volumes | 3 × 8 GB gp3 | $2.40 |
| **Subtotal** | | **$184.44/month** |

**ML Service (Production)**:
| Resource | Specification | Monthly Cost (On-Demand) |
|----------|---------------|-------------------------|
| t3.medium instances | 2 instances × 730 hours | $60.74 (2 × $0.0416/hr × 730) |
| EBS volumes | 2 × 8 GB gp3 | $1.60 |
| **Subtotal** | | **$62.34/month** |

**Total EC2 (On-Demand)**: **$246.78/month**

### 5.2 Application Load Balancer Costs

**Pricing** (us-east-2):
- ALB hour: $0.0225/hour
- LCU (Load Capacity Unit): $0.008/LCU-hour

**Estimated Monthly Cost** (2 ALBs):
| Component | Calculation | Monthly Cost |
|-----------|-------------|--------------|
| ALB Hours | 2 × $0.0225 × 730 | $32.85 |
| LCU Usage | 2 × ~10 LCU × $0.008 × 730 | $116.80 |
| **Total ALB** | | **~$150/month** |

*Note: LCU usage varies with traffic. 10 LCU is an estimate for moderate traffic.*

### 5.3 Data Transfer Costs

**Critical Finding: ML Service Communication**

The main server communicates with the ML service via public HTTPS (through the internet), even though both are in the same AWS region/VPC.

**Estimated ML Service Data Transfer**:
- Average recommendation request: 5 KB
- Average recommendation response: 20 KB
- Requests per day: ~10,000 (estimate)
- Monthly data: ~750 MB
- **Cost at current architecture**: ~$0.14/month (minimal but inefficient)

**Main Application Data Transfer**:
| Transfer Type | Estimated Monthly | Rate | Cost |
|---------------|-------------------|------|------|
| Internet Egress (first 10TB) | ~500 GB | $0.09/GB | $45.00 |
| S3 to EC2 (same region) | ~200 GB | $0.00 (VPC Endpoint) | $0.00 |
| DynamoDB to EC2 | ~50 GB | $0.00 (same region) | $0.00 |
| **Total Data Transfer** | | | **~$45/month** |

### 5.4 Lambda Costs

**Daily Jobs Lambda**:
| Metric | Value | Cost |
|--------|-------|------|
| Invocations | 30/month | Free tier |
| Duration | ~60 sec × 1024 MB | ~$0.001/month |

**Card Update Monitor Lambda**:
| Metric | Value | Cost |
|--------|-------|------|
| Invocations | 288/day × 30 = 8,640/month | Free tier covers first 1M |
| Duration | ~10 sec × 512 MB | ~$0.05/month |

**Total Lambda**: **~$0.06/month** (negligible)

### 5.5 ECS Fargate Costs

**Jobs Task (on-demand, ~2-4 runs/month)**:
| Resource | Specification | Cost per Hour |
|----------|---------------|---------------|
| CPU | 4 vCPU | $0.04048/vCPU-hour × 4 = $0.162 |
| Memory | 30 GB | $0.004445/GB-hour × 30 = $0.133 |
| **Per Hour** | | **$0.295/hour** |

Assuming 4 runs/month × 1.5 hours average = 6 hours:
**Monthly Fargate**: **~$2/month**

### 5.6 DynamoDB Costs

**Pricing** (Pay-per-request):
- Write: $1.25 per million WCU
- Read: $0.25 per million RCU
- Storage: $0.25/GB-month

**Estimated Usage**:
| Operation | Monthly Estimate | Cost |
|-----------|-----------------|------|
| Read Capacity | ~50 million RCU | $12.50 |
| Write Capacity | ~10 million WCU | $12.50 |
| Storage | ~20 GB | $5.00 |
| **Total DynamoDB** | | **~$30/month** |

### 5.7 S3 Costs

**Pricing** (Standard):
- Storage: $0.023/GB-month
- GET requests: $0.0004/1000 requests
- PUT requests: $0.005/1000 requests

**Estimated Usage**:
| Component | Estimate | Cost |
|-----------|----------|------|
| Storage | ~100 GB | $2.30 |
| GET requests | ~10M/month | $4.00 |
| PUT requests | ~500K/month | $2.50 |
| **Total S3** | | **~$9/month** |

### 5.8 Other Services

| Service | Estimated Monthly Cost |
|---------|----------------------|
| Route 53 | ~$1 (hosted zones + queries) |
| ACM | Free (public certificates) |
| CloudWatch Logs | ~$5 (ingestion + storage) |
| SES | ~$1 (email sending) |
| ECR | ~$1 (storage) |
| CodePipeline | ~$1 |
| CodeBuild | ~$5 (build minutes) |
| **Total Other** | **~$14/month** |

### 5.9 Total Monthly Cost Estimate

| Category | Monthly Cost |
|----------|-------------|
| EC2 (Main + ML) | $246.78 |
| Application Load Balancers | $150.00 |
| Data Transfer | $45.00 |
| DynamoDB | $30.00 |
| S3 | $9.00 |
| Lambda | $0.06 |
| Fargate | $2.00 |
| Other Services | $14.00 |
| **TOTAL** | **~$497/month** |

---

## 6. Cost Savings Plan

### 6.1 High-Impact Recommendations

#### 6.1.1 EC2 Savings Plans / Reserved Instances

**Current State**: All EC2 instances are on-demand pricing

**Recommendation**: Purchase 1-year Savings Plans (Compute)

| Plan Type | Discount | Annual Savings |
|-----------|----------|----------------|
| 1-Year All Upfront | ~36% | ~$1,065/year |
| 1-Year No Upfront | ~28% | ~$829/year |
| 3-Year All Upfront | ~55% | ~$1,628/year |

**Recommended Action**: Purchase 1-year No Upfront Savings Plan for 5 instance baseline (3 main + 2 ML)

**Estimated Savings**: **$70/month ($829/year)**

#### 6.1.2 Consolidate ML Service with Main Server

**Current State**: ML service runs on separate Elastic Beanstalk environment with dedicated ALB

**Issues**:
1. Separate ALB adds ~$75/month in fixed costs
2. Cross-service calls go through public internet
3. Two separate auto-scaling groups to manage

**Recommendation**: Run ML service as a sidecar process or separate port on main server instances

**Implementation Options**:

**Option A**: Process Manager (PM2) Multi-App
```javascript
// ecosystem.config.js
module.exports = {
  apps: [
    { name: 'server', script: 'dist/index.js', port: 8080 },
    { name: 'ml-service', script: 'dist/ml/index.js', port: 5002 }
  ]
};
```
- ML calls become `http://localhost:5002` instead of external HTTPS
- Single ALB with path-based routing

**Option B**: Keep Separate Services, Use Private Load Balancer
- Convert ML ALB to internal ALB
- Use VPC private DNS for service discovery
- Eliminates internet data transfer

**Estimated Savings**:
- ALB elimination: **$75/month**
- Data transfer: **~$1/month** (minimal current, but scales with traffic)
- Operational simplicity: Priceless

**Recommended**: Option A (consolidation) for simplicity

#### 6.1.3 Right-Size ECS Fargate Tasks

**Current State**: Jobs run with 4 vCPU / 30 GB RAM

**Analysis**: Review CloudWatch metrics for actual CPU/memory utilization

**If utilization is <70%**:
- Reduce to 2 vCPU / 16 GB (matches code configuration default)
- Savings: ~50% on Fargate costs (~$1/month)

**If memory-bound only**:
- Consider 2 vCPU / 30 GB configuration
- Valid Fargate configuration exists

#### 6.1.4 Implement S3 Intelligent-Tiering

**Current State**: All S3 objects in Standard tier

**Recommendation**: Enable S3 Intelligent-Tiering for data bucket

**Benefits**:
- Automatic cost optimization for infrequently accessed data
- No retrieval fees for Frequent Access tier
- Monitoring fee: $0.0025/1000 objects

**Best Candidates**:
- `cube_draft_history/*` - Historical data, rarely accessed
- `cube_analytic/*` - Analytics, accessed during cube views
- Old content bodies

**Estimated Savings**: **$0.50-1/month** (depends on access patterns)

### 6.2 Medium-Impact Recommendations

#### 6.2.1 Optimize DynamoDB with DAX (If Read-Heavy)

**Analysis Needed**: Review DynamoDB read patterns

**If consistent read patterns exist**:
- Deploy DAX cluster for caching
- t3.small DAX node: ~$30/month
- Potential RCU savings: 50-80%

**Break-even Analysis**:
- Current read cost: ~$12.50/month
- DAX cost: ~$30/month
- **Not recommended unless read costs exceed $50/month**

#### 6.2.2 Implement CloudFront CDN

**Current State**: No CDN, all static assets served from EC2

**Recommendation**: Add CloudFront distribution for static assets

**Benefits**:
1. Reduced EC2 load (offload static asset serving)
2. Lower data transfer costs (CloudFront cheaper than EC2 egress)
3. Better global performance
4. Edge caching for card images

**Implementation**:
```
CloudFront Distribution
├── Origin: ALB (dynamic content)
├── Origin: S3 (static assets)
└── Behaviors:
    ├── /js/* → S3 (cache 1 year, immutable)
    ├── /css/* → S3 (cache 1 day)
    ├── /content/* → S3 (cache 1 day)
    └── Default → ALB (no cache)
```

**Cost Analysis**:
| Component | Current | With CloudFront |
|-----------|---------|-----------------|
| Data Transfer | $45/month | ~$30/month |
| CloudFront | $0 | ~$10/month |
| **Net Savings** | | **$5/month** |

**Verdict**: Implement for performance benefits; cost savings are marginal.

#### 6.2.3 Review Lambda Memory Allocation

**Daily Jobs Lambda**: 1024 MB
- If execution time is CPU-bound, more memory = faster = cheaper
- If memory-bound, current allocation may be correct
- **Action**: Profile and right-size

**Card Monitor Lambda**: 512 MB
- Likely appropriate for API calls
- **Action**: Monitor and adjust if needed

### 6.3 Low-Impact / Future Considerations

#### 6.3.1 Spot Instances for Non-Critical Workloads

**ECS Fargate Spot**:
- Up to 70% discount
- Suitable for jobs that can be interrupted and restarted
- **Current jobs run ~4 times/month**: Savings would be ~$1.40/month (not worth complexity)

#### 6.3.2 Graviton (ARM) Instances

**Future Consideration**: When upgrading Node.js or instance types
- Graviton3 instances: ~20% better price/performance
- t4g.large vs t3.large: $0.0672/hr vs $0.0832/hr (19% savings)
- Requires: Testing application compatibility with ARM

**Potential Savings**: ~$35/month (when migrating)

#### 6.3.3 DynamoDB On-Demand vs Provisioned

**Analysis**: Review CloudWatch metrics for consistent baseline usage

If traffic is predictable:
- Switch to provisioned capacity
- Enable auto-scaling
- Potential savings: 20-30% for predictable workloads

**Not Recommended Currently**: Pay-per-request is safer for variable workloads

---

## 7. Recommendations Summary

### Immediate Actions (This Month)

| Priority | Action | Monthly Savings | Implementation Effort |
|----------|--------|-----------------|----------------------|
| 1 | Purchase 1-Year Savings Plan | $70 | Low (AWS Console) |
| 2 | Consolidate ML Service | $75 | Medium (Code changes) |
| **Total** | | **$145/month** | |

### Short-Term Actions (Next Quarter)

| Priority | Action | Monthly Savings | Implementation Effort |
|----------|--------|-----------------|----------------------|
| 3 | Implement CloudFront CDN | $5 | Medium |
| 4 | Enable S3 Intelligent-Tiering | $1 | Low |
| 5 | Right-size Fargate tasks | $1 | Low |
| **Total** | | **$7/month** | |

### Long-Term Considerations

| Action | Potential Savings | When to Consider |
|--------|-------------------|------------------|
| Graviton migration | $35/month | Next major upgrade |
| DAX caching | Variable | If read costs exceed $50/month |
| DynamoDB provisioned | $6-10/month | When traffic patterns stabilize |

### Total Potential Savings

| Timeline | Monthly Savings | Annual Savings |
|----------|-----------------|----------------|
| Immediate | $145 | $1,740 |
| Short-Term | $152 | $1,824 |
| Long-Term | Up to $190 | Up to $2,280 |

**Current Monthly Cost**: ~$497
**Optimized Monthly Cost**: ~$345-355
**Savings Percentage**: ~29-31%

---

## Appendix A: Data Transfer Pricing Reference

### AWS Data Transfer Pricing (us-east-2, as of 2024)

| Transfer Type | Cost |
|---------------|------|
| Internet → AWS (ingress) | Free |
| AWS → Internet (first 10 TB/month) | $0.09/GB |
| AWS → Internet (next 40 TB/month) | $0.085/GB |
| AWS → Internet (next 100 TB/month) | $0.07/GB |
| Same Region, Same AZ | Free |
| Same Region, Cross-AZ | $0.01/GB (each direction) |
| Cross-Region | $0.02/GB |
| EC2 → S3 (same region, Gateway Endpoint) | Free |
| EC2 → DynamoDB (same region) | Free* |

*DynamoDB data transfer is free within the same region when accessed via AWS PrivateLink or the public endpoint.

### Application Load Balancer Pricing

| Component | Cost |
|-----------|------|
| ALB per hour | $0.0225/hour |
| LCU per hour | $0.008/LCU-hour |

**LCU Calculation** (highest of):
- New connections: 25/second
- Active connections: 3,000
- Processed bytes: 1 GB/hour
- Rule evaluations: 1,000/second

### Elastic Beanstalk Pricing

Elastic Beanstalk itself is free; you pay for:
- EC2 instances
- Load balancers
- Data transfer
- Additional services (CloudWatch, etc.)

---

## Appendix B: Architecture Decision Records

### ADR-001: Single-Table DynamoDB Design

**Decision**: Use single-table design with composite keys

**Rationale**:
- Reduces operational overhead
- Enables complex queries with GSIs
- Pay-per-request billing simplifies cost management
- Atomic transactions across related items

**Trade-offs**:
- More complex data modeling
- Requires careful key design
- All entities share table capacity

### ADR-002: Hybrid Storage (DynamoDB + S3)

**Decision**: Store metadata in DynamoDB, large objects in S3

**Rationale**:
- DynamoDB item size limit: 400 KB
- Cube card lists can exceed this limit (up to 10,000 cards)
- S3 is more cost-effective for large objects
- Enables direct S3 access for data exports

**Implementation**:
- DynamoDB stores references (S3 keys)
- Server fetches from S3 when needed
- S3 objects are JSON for easy processing

### ADR-003: Elastic Beanstalk over ECS/EKS

**Decision**: Use Elastic Beanstalk for web tier

**Rationale**:
- Simpler operational model
- Built-in deployment strategies
- Managed ALB integration
- Auto-scaling included
- Lower learning curve than EKS

**Trade-offs**:
- Less flexibility than ECS/EKS
- Vendor lock-in to EB-specific features
- Limited customization of underlying infrastructure

### ADR-004: Lambda for Light Jobs, Fargate for Heavy Jobs

**Decision**: Use Lambda for lightweight scheduled tasks, Fargate for data processing

**Rationale**:
- Lambda: Perfect for tasks under 15 minutes, low memory
- Fargate: Required for memory-intensive jobs (30 GB needed)
- Cost-effective: Only pay for actual execution time
- No server management

**Implementation**:
- Daily Jobs Lambda: Podcasts, rotations
- Card Monitor Lambda: API monitoring, task orchestration
- Fargate Tasks: Card updates, analytics processing
