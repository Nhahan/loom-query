# LoomQuery Error Codes & Recovery Guide

This document describes error classifications, retry behavior, and recovery procedures for the embedding pipeline.

## Error Classification System

All errors are classified into three categories:

| Category | Retry Behavior | Examples | Recovery Action |
|----------|----------------|----------|-----------------|
| **Transient** | Exponential backoff (1s, 4s, 16s) | Network timeouts, rate limits, temporary service unavailability | Wait and retry automatically |
| **Permanent** | Fail immediately | File not found, permission denied, invalid data | Fix root cause, resubmit |
| **Unknown** | Conservative backoff (2s, 4s, 6s) | Unexpected errors | Log and investigate |

## Error Codes Reference

### Transient Errors (Retryable)

#### `NETWORK_ERROR`
- **Cause**: Network connectivity issues
- **Examples**: ENOTFOUND, ECONNREFUSED, ENETUNREACH, broken pipe, reset by peer
- **Retry**: Yes (exponential backoff)
- **Resolution**:
  1. Verify network connectivity
  2. Check firewall rules
  3. Restart services if needed
  4. Check system logs for detailed error

#### `SERVICE_UNAVAILABLE`
- **Cause**: External service temporarily down (Ollama, ChromaDB)
- **Examples**: Connection timeout, service responding with 503
- **Retry**: Yes (exponential backoff)
- **Resolution**:
  1. Check service health: `/api/queue/health`
  2. Verify service is running (ollama, chroma)
  3. Wait for automatic recovery (circuit breaker reopens after 60s)
  4. Manually restart service if needed

#### `RATE_LIMITED`
- **Cause**: Too many requests to external service
- **Examples**: HTTP 429, "rate limit exceeded"
- **Retry**: Yes (exponential backoff with longer delays)
- **Resolution**:
  1. Reduce `WORKER_CONCURRENCY` (default: 2)
  2. Reduce `WORKER_RATE_LIMIT_MAX` (default: 10 jobs/sec)
  3. Wait for rate limit window to reset
  4. Adjust embedBatch size if needed

#### `RESOURCE_EXHAUSTED`
- **Cause**: Out of memory or system resources
- **Examples**: ENOMEM, "out of memory"
- **Retry**: Yes (with conservative backoff)
- **Resolution**:
  1. Check available system memory: `free -h`
  2. Reduce document chunk size (currently 512 chars max)
  3. Reduce worker concurrency
  4. Restart worker process to clear memory

### Permanent Errors (Non-Retryable)

#### `NOT_FOUND`
- **Cause**: Document or resource doesn't exist
- **Examples**: Document ID not in database, file not found
- **Retry**: No
- **Resolution**:
  1. Verify document ID exists: `SELECT * FROM documents WHERE id = '{id}'`
  2. Check if document was deleted
  3. Resubmit document for embedding
  4. Check application logs for deletion events

#### `AUTH_ERROR`
- **Cause**: Authentication or permission failure
- **Examples**: Unauthorized API key, permission denied (EACCES)
- **Retry**: No
- **Resolution**:
  1. Verify API credentials: `QUEUE_ADMIN_SECRET` in `.env`
  2. Check service authentication config
  3. Verify file system permissions: `ls -la /chroma /ollama`
  4. Restart service with correct credentials

#### `INVALID_DATA`
- **Cause**: Malformed or invalid input data
- **Examples**: Parse error, invalid JSON, syntax error
- **Retry**: No
- **Resolution**:
  1. Check document content: `SELECT content FROM documents WHERE id = '{id}'`
  2. Verify document encoding is UTF-8
  3. Check for extremely large documents (>50MB)
  4. Validate document format/structure

## Monitoring & Observability

### Health Check Endpoint

```bash
# Check queue health and circuit breaker states
curl http://localhost:3000/api/queue/health | jq
```

**Response fields:**
- `status`: healthy | degraded | unhealthy
- `metrics`: Job counts, latencies, success rates
- `circuitBreakers`: Ollama & ChromaDB states (CLOSED | OPEN | HALF_OPEN)
- `errorBreakdown`: Count by error code
- `recentErrors`: Last 5 failures with error codes

### Circuit Breaker States

| State | Behavior | Recovery |
|-------|----------|----------|
| **CLOSED** | Service working normally, requests proceed | Automatic on error recovery |
| **OPEN** | Service down, requests fail fast (circuit open) | Attempts recovery after 60s |
| **HALF_OPEN** | Testing recovery, limited requests allowed | Closes on 2 consecutive successes |

### Metrics Available

Access metrics via `/api/queue/health`:
- `totalJobs`: Lifetime job count
- `completedJobs`: Successfully processed jobs
- `failedJobs`: Jobs failed after all retries
- `successRate`: Percentage of successful jobs
- `failureRate`: Percentage of failed jobs
- `avgDuration` / `p50` / `p95` / `p99`: Latency percentiles in milliseconds

## Troubleshooting Workflow

### Step 1: Check Overall Health
```bash
curl http://localhost:3000/api/queue/health
```

### Step 2: Identify Error Pattern
- Look at `errorBreakdown` for common error codes
- Check `recentErrors` for latest failures
- Review application logs: `docker logs loom-query-api`

### Step 3: Take Action Based on Error Code
```
NETWORK_ERROR    → Check connectivity, verify services running
SERVICE_UNAVAIL  → Check /api/queue/health, wait for circuit recovery
RATE_LIMITED     → Reduce WORKER_CONCURRENCY or WORKER_RATE_LIMIT_MAX
NOT_FOUND        → Verify document exists, resubmit
AUTH_ERROR       → Check credentials and permissions
INVALID_DATA     → Check document content and encoding
```

### Step 4: Monitor Recovery
```bash
# Watch metrics recovery
watch -n 5 'curl -s http://localhost:3000/api/queue/health | jq ".metrics"'
```

## Environment Variables for Tuning

### Performance Tuning
- `WORKER_CONCURRENCY` (default: 2) - Parallel jobs
- `WORKER_RATE_LIMIT_MAX` (default: 10) - Max jobs per rate window
- `WORKER_RATE_LIMIT_DURATION` (default: 1000ms) - Rate limit window

### Timeout & Retry
- BullMQ retry: 3 attempts with exponential backoff (hardcoded)
- Ollama/ChromaDB: Circuit breaker timeout: 60s (hardcoded)
- Network timeout: 30s (from Mastra/Chroma defaults)

## Example Scenarios

### Scenario 1: Documents Stuck in "processing"
**Symptom**: Documents never reach "done" status
**Investigation**:
```bash
# Check queue health
curl http://localhost:3000/api/queue/health | jq ".circuitBreakers"

# Check logs for error type
docker logs loom-query-api | tail -100 | grep "Job failed"
```

**Solutions**:
- If circuit is OPEN: Wait 60s for automatic recovery
- If `NOT_FOUND`: Verify document wasn't deleted
- If `NETWORK_ERROR`: Check Ollama/ChromaDB connectivity

### Scenario 2: Slow Embedding
**Symptom**: High `p95Duration`, documents taking minutes
**Investigation**:
```bash
# Check latency percentiles
curl http://localhost:3000/api/queue/health | jq ".metrics | {p50: .p50Duration, p95: .p95Duration, p99: .p99Duration}"
```

**Solutions**:
- Check Ollama performance: Is it running slowly?
- Reduce document chunk size
- Reduce concurrency to prevent Ollama overload
- Check system resources (CPU, memory)

### Scenario 3: Repeated Rate Limiting
**Symptom**: Frequent `RATE_LIMITED` errors, recovery > 1 hour
**Investigation**:
```bash
# Check error breakdown
curl http://localhost:3000/api/queue/health | jq ".errorBreakdown"
```

**Solutions**:
```bash
# Reduce rate limits
export WORKER_RATE_LIMIT_MAX=5        # 5 jobs/sec instead of 10
export WORKER_CONCURRENCY=1           # Sequential processing
# Restart worker
docker restart loom-query-worker
```

## Support & Escalation

### For Transient Errors
- Most will auto-recover after backoff
- Monitor via `/api/queue/health`
- Escalate only if error persists > 5 minutes

### For Permanent Errors
- Fix root cause immediately
- Resubmit failed documents
- Review application logs for patterns

### For Unknown Errors
- Check application logs for full stack trace
- Run: `docker logs -f loom-query-api | grep "Unknown""`
- Escalate with error message + logs + timestamp

---

**Last updated**: 2026-03-08
**Maintained by**: LoomQuery Team
**Related docs**: [Performance Tuning](./PERFORMANCE.md) | [Deployment Guide](./DEPLOYMENT.md)
