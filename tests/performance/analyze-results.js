#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// Configuration
const LATENCY_THRESHOLD_P95 = 500; // Target P95 latency in ms
const REQUEST_RATE_TARGET = 20;     // Target requests per second

// Find the latest results
function findLatestResults(directory, extension) {
  const files = fs.readdirSync(directory)
    .filter(file => file.endsWith(extension))
    .map(file => ({
      name: file,
      path: path.join(directory, file),
      mtime: fs.statSync(path.join(directory, file)).mtime
    }))
    .sort((a, b) => b.mtime - a.mtime);
  
  return files.length > 0 ? files[0] : null;
}

// Parse K6 CSV results
function parseK6Results(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, { columns: true });
  
  // Extract metrics
  const metrics = {
    http_req_duration: [],
    http_reqs: 0,
    errors: 0,
    data_received: 0,
    data_sent: 0,
    iterations: 0,
    vus: 0,
    vus_max: 0
  };
  
  records.forEach(record => {
    const metric = record.metric;
    const value = parseFloat(record.value);
    
    if (metric === 'http_req_duration' && !isNaN(value)) {
      metrics.http_req_duration.push(value);
    } else if (metric === 'http_reqs') {
      metrics.http_reqs += value;
    } else if (metric === 'errors') {
      metrics.errors += value;
    } else if (metric === 'data_received') {
      metrics.data_received += value;
    } else if (metric === 'data_sent') {
      metrics.data_sent += value;
    } else if (metric === 'iterations') {
      metrics.iterations += value;
    } else if (metric === 'vus') {
      metrics.vus = Math.max(metrics.vus, value);
    } else if (metric === 'vus_max') {
      metrics.vus_max = Math.max(metrics.vus_max, value);
    }
  });
  
  return metrics;
}

// Parse Artillery JSON results
function parseArtilleryResults(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const data = JSON.parse(content);
  
  const summary = data.aggregate;
  
  // Extract key metrics
  return {
    latencies: {
      p95: summary.latency.p95,
      p99: summary.latency.p99,
      min: summary.latency.min,
      max: summary.latency.max,
      median: summary.latency.median
    },
    requestsCompleted: summary.counters['http.requests'],
    requestsPerSecond: summary.rates['http.request_rate'],
    scenariosCreated: summary.counters['vusers.created'],
    scenariosCompleted: summary.counters['vusers.completed'],
    scenariosFailed: summary.counters['vusers.failed'],
    errors: summary.errors,
    httpCodes: summary.codes
  };
}

// Calculate percentiles
function calculatePercentile(values, percentile) {
  if (values.length === 0) return 0;
  
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index];
}

// Format metrics for output
function formatMetrics(results, tool) {
  if (tool === 'k6') {
    const durations = results.http_req_duration;
    const p95 = calculatePercentile(durations, 95);
    const p99 = calculatePercentile(durations, 99);
    const median = calculatePercentile(durations, 50);
    const min = Math.min(...durations);
    const max = Math.max(...durations);
    const totalTime = results.iterations > 0 ? results.http_reqs / results.iterations : 0;
    
    return {
      latencies: {
        p95,
        p99,
        min,
        max,
        median
      },
      requestsCompleted: results.http_reqs,
      requestsPerSecond: totalTime,
      iterations: results.iterations,
      errors: results.errors,
      vus: results.vus,
      vus_max: results.vus_max,
      dataReceived: results.data_received,
      dataSent: results.data_sent
    };
  } else if (tool === 'artillery') {
    return results;
  }
  
  return {};
}

// Analyze performance against targets
function analyzePerformance(metrics, tool) {
  const issues = [];
  let p95Latency, requestRate;
  
  if (tool === 'k6') {
    p95Latency = metrics.latencies.p95;
    requestRate = metrics.requestsPerSecond;
  } else if (tool === 'artillery') {
    p95Latency = metrics.latencies.p95;
    requestRate = metrics.requestsPerSecond;
  }
  
  // Check if p95 latency meets target
  if (p95Latency > LATENCY_THRESHOLD_P95) {
    issues.push({
      severity: 'HIGH',
      message: `P95 latency (${p95Latency.toFixed(2)}ms) exceeds target (${LATENCY_THRESHOLD_P95}ms)`,
      recommendations: [
        'Implement or optimize response caching',
        'Review database query performance',
        'Check for slow API dependencies',
        'Consider adding more compute resources'
      ]
    });
  }
  
  // Check if request rate meets target
  if (requestRate < REQUEST_RATE_TARGET) {
    issues.push({
      severity: 'MEDIUM',
      message: `Request rate (${requestRate.toFixed(2)}/s) is below target (${REQUEST_RATE_TARGET}/s)`,
      recommendations: [
        'Increase connection pooling',
        'Optimize request handling',
        'Implement batch processing for heavy operations',
        'Scale horizontally for better throughput'
      ]
    });
  }
  
  // Check for high error rate
  const errorRate = tool === 'k6' 
    ? (metrics.errors / metrics.requestsCompleted) * 100
    : (metrics.scenariosFailed / metrics.scenariosCreated) * 100;
  
  if (errorRate > 1) {
    issues.push({
      severity: 'HIGH',
      message: `Error rate (${errorRate.toFixed(2)}%) is above acceptable threshold (1%)`,
      recommendations: [
        'Check server logs for errors',
        'Verify error handling in API endpoints',
        'Ensure rate limiting is properly configured',
        'Check for connection timeouts'
      ]
    });
  }
  
  return {
    issues,
    meetsTargets: issues.length === 0,
    p95LatencyStatus: p95Latency <= LATENCY_THRESHOLD_P95 ? 'PASS' : 'FAIL',
    requestRateStatus: requestRate >= REQUEST_RATE_TARGET ? 'PASS' : 'FAIL',
    errorRateStatus: errorRate <= 1 ? 'PASS' : 'FAIL'
  };
}

// Generate performance report
function generateReport(metrics, analysis, tool) {
  const now = new Date();
  const report = {
    timestamp: now.toISOString(),
    tool,
    metrics,
    analysis,
    summary: {
      status: analysis.meetsTargets ? 'PASS' : 'FAIL',
      message: analysis.meetsTargets 
        ? 'Performance targets met!'
        : `Performance issues detected: ${analysis.issues.length}`,
      targets: {
        p95Latency: `${LATENCY_THRESHOLD_P95}ms`,
        requestRate: `${REQUEST_RATE_TARGET}/s`,
        maxErrorRate: '1%'
      }
    }
  };
  
  // Save report to file
  const reportDir = path.join(__dirname, '../results');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  const reportPath = path.join(reportDir, `performance-report-${now.toISOString().replace(/:/g, '-')}.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  
  // Print summary to console
  console.log('\n========================================');
  console.log(' PERFORMANCE TEST ANALYSIS');
  console.log('========================================\n');
  console.log(`Tool: ${tool.toUpperCase()}`);
  console.log(`Time: ${now.toLocaleString()}`);
  console.log(`Status: ${report.summary.status}`);
  console.log(`\nP95 Latency: ${metrics.latencies.p95.toFixed(2)}ms [${analysis.p95LatencyStatus}]`);
  console.log(`Request Rate: ${tool === 'k6' ? metrics.requestsPerSecond.toFixed(2) : metrics.requestsPerSecond.toFixed(2)}/s [${analysis.requestRateStatus}]`);
  
  const errorRate = tool === 'k6' 
    ? (metrics.errors / metrics.requestsCompleted) * 100
    : (metrics.scenariosFailed / metrics.scenariosCreated) * 100;
  
  console.log(`Error Rate: ${errorRate.toFixed(2)}% [${analysis.errorRateStatus}]`);
  
  if (analysis.issues.length > 0) {
    console.log('\nIssues found:');
    analysis.issues.forEach((issue, i) => {
      console.log(`\n[${issue.severity}] ${issue.message}`);
      console.log('Recommendations:');
      issue.recommendations.forEach(rec => console.log(` - ${rec}`));
    });
  }
  
  console.log(`\nDetailed report saved to: ${reportPath}`);
  console.log('\n========================================\n');
  
  return reportPath;
}

// Main function
async function main() {
  console.log('Analyzing performance test results...');
  
  // Check for K6 results
  const k6ResultsDir = path.join(__dirname, '../results');
  if (!fs.existsSync(k6ResultsDir)) {
    fs.mkdirSync(k6ResultsDir, { recursive: true });
  }
  
  const k6Results = findLatestResults(k6ResultsDir, '.csv');
  if (k6Results) {
    console.log(`Found K6 results: ${k6Results.name}`);
    const metrics = parseK6Results(k6Results.path);
    const formattedMetrics = formatMetrics(metrics, 'k6');
    const analysis = analyzePerformance(formattedMetrics, 'k6');
    generateReport(formattedMetrics, analysis, 'k6');
  }
  
  // Check for Artillery results
  const artilleryResultsDir = path.join(__dirname, '../results');
  const artilleryResults = findLatestResults(artilleryResultsDir, '.json');
  if (artilleryResults) {
    console.log(`Found Artillery results: ${artilleryResults.name}`);
    const metrics = parseArtilleryResults(artilleryResults.path);
    const analysis = analyzePerformance(metrics, 'artillery');
    generateReport(metrics, analysis, 'artillery');
  }
  
  if (!k6Results && !artilleryResults) {
    console.log('No test results found. Run load tests first.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Error analyzing results:', err);
  process.exit(1);
}); 