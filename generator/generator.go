package main

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/grafana/explore-logs/generator/flog"
	"github.com/grafana/explore-logs/generator/log"
	"github.com/grafana/loki/pkg/push"
	"github.com/prometheus/common/model"
)

type LogGenerator func(ctx context.Context, logger *log.AppLogger, metadata push.LabelsAdapter)

var generators = map[model.LabelValue]map[model.LabelValue]LogGenerator{
	"gateway": {
		"apache": func(ctx context.Context, logger *log.AppLogger, metadata push.LabelsAdapter) {
			go func() {
				for ctx.Err() == nil {
					level := log.RandLevel()
					t := time.Now()
					logger.LogWithMetadata(level, t, flog.NewApacheCommonLog(t, log.RandURI(), statusFromLevel(level)), metadata)
					time.Sleep(time.Duration(rand.Intn(5000)) * time.Millisecond)
				}
			}()
		},
		"httpd": func(ctx context.Context, logger *log.AppLogger, metadata push.LabelsAdapter) {
			go func() {
				for ctx.Err() == nil {
					level := log.RandLevel()
					t := time.Now()
					logger.LogWithMetadata(level, t, flog.NewApacheCombinedLog(t, log.RandURI(), statusFromLevel(level)), metadata)
					time.Sleep(time.Duration(rand.Intn(5000)) * time.Millisecond)
				}
			}()
		},
		"nginx": func(ctx context.Context, logger *log.AppLogger, metadata push.LabelsAdapter) {
			go func() {
				for ctx.Err() == nil {
					level := log.RandLevel()
					t := time.Now()
					logger.LogWithMetadata(level, t, flog.NewCommonLogFormat(t, log.RandURI(), statusFromLevel(level)), metadata)
					time.Sleep(time.Duration(rand.Intn(5000)) * time.Millisecond)
				}
			}()
		},
		"nginx-json": func(ctx context.Context, logger *log.AppLogger, metadata push.LabelsAdapter) {
			go func() {
				for ctx.Err() == nil {
					level := log.RandLevel()
					t := time.Now()
					logger.LogWithMetadata(level, t, flog.NewJSONLogFormat(t, log.RandURI(), statusFromLevel(level)), metadata)
					time.Sleep(time.Duration(rand.Intn(5000)) * time.Millisecond)
				}
			}()
		},
		"nginx-json-mixed": func(ctx context.Context, logger *log.AppLogger, metadata push.LabelsAdapter) {
			go func() {
				for ctx.Err() == nil {
					level := log.RandLevel()
					t := time.Now()
					if level == log.ERROR {
						log := flog.NewCommonLogFormat(t, log.RandURI(), statusFromLevel(level))
						// Add a stacktrace to the logfmt log, and include a field that will conflict with stream selectors
						logger.LogWithMetadata(level, t, fmt.Sprintf("%s %s", log, `method=GET namespace=whoopsie caller=flush.go:253 stacktrace="Exception in thread \"main\" java.lang.NullPointerException\n        at com.example.myproject.Book.getTitle(Book.java:16)\n        at com.example.myproject.Author.getBookTitles(Author.java:25)\n        at com.example.myproject.Bootstrap.main(Bootstrap.java:14)"`), metadata)
					}
					logger.LogWithMetadata(level, t, flog.NewJSONLogFormat(t, log.RandURI(), statusFromLevel(level)), metadata)
					time.Sleep(time.Duration(rand.Intn(5000)) * time.Millisecond)
				}
			}()
		},
	},

	"mimir-dev": {
		"mimir-ingester":    mimirPod,
		"mimir-distributor": mimirPod,
		"mimir-querier":     mimirPod,
		"mimir-ruler":       mimirPod,
	},
	"mimir-prod": {
		"mimir-ingester": mimirPod,
	},
	"tempo-prod": {
		"tempo-ingester":    noisyTempo,
		"tempo-distributor": noisyTempo,
	},
	"tempo-dev": {
		"tempo-ingester":    noisyTempo,
		"tempo-distributor": noisyTempo,
	},
	"loki-otel": {
		"loki-ingester-otel":      lokiOtelPod("loki-ingester-otel"),
		"loki-querier-otel":       lokiOtelPod("loki-querier-otel"),
		"loki-queryfrontend-otel": lokiOtelPod("loki-queryfrontend-otel"),
		"loki-distributor-otel":   lokiOtelPod("loki-distributor-otel"),
	},
}

func lokiOtelPod(svc string) LogGenerator {
	logs := map[string]map[model.LabelValue]string{
		"loki-ingester-otel": {
			log.ERROR: lokiGRPCLog("connection refused to object store", "/loki.Ingester/Push"),
			log.INFO:  lokiGRPCLog("", "/loki.Ingester/Push"),
		},
		"loki-querier-otel": {
			log.INFO:  lokiGRPCLog("caller=engine.go:263 component=querier org_id=29 traceID=<_> msg=\"executing query\" query=<_> query_hash=1182293200 type=range length=20s step=4 token_id=123", "loki.Query/Engine"),
			log.DEBUG: lokiGRPCLog("caller=scheduler_processor.go:135 component=querier msg=\"received query\" worker=<_> wait_time_sec=20s", "loki.Query/SchedulerProcessor"),
		},
		"loki-queryfrontend-otel": {
			log.INFO: lokiGRPCLog("caller=roundtrip.go:419 org_id=29 traceID=213098 msg=\"executing query\" type=instant query=\"abc\" query_hash=120938", "loki.Query/QueryRange"),
		},
		"loki-distributor-otel": {
			log.DEBUG: lokiGRPCLog("caller=push.go:165 org_id=29 traceID=192382 msg=\"push request parsed\" path=push.go contentType=application/x-protobuf contentEncoding= bodySize=129KB streams=12938 entries=81902398 streamLabelsSize=2KB entriesSize=2MB structuredMetadataSize=200KB totalSize=20MB mostRecentLagMs=10s", "loki.Distributor/Push"),
			log.INFO:  lokiGRPCLog("caller=tee_service.go:273 msg=\"prepared Tee batches for tenant\" tenant=29 stream_count=100 avg_logs_slice_cap_start=120 avg_logs_slice_cap_end=123992 avg_logs_slice_len_end=10200 avg_log_lines_count=122300 avg_log_line_length=10s", "loki.Distributor/Tee"),
		},
	}
	return func(ctx context.Context, logger *log.AppLogger, metadata push.LabelsAdapter) {
		serviceLogs := logs[svc]
		for k, v := range serviceLogs {
			go func() {
				for ctx.Err() == nil {
					t := time.Now()
					logger.LogWithMetadata(k, t, v, log.RandStructuredMetadata("loki-ingester", 0))
					time.Sleep(time.Duration(rand.Intn(5000)) * time.Millisecond)
				}
			}()
		}
	}
}

var noisyTempo = func(ctx context.Context, logger *log.AppLogger, metadata push.LabelsAdapter) {
	const fmt1 = `level=debug ts=%s caller=broadcast.go:48 msg="Invalidating forwarded broadcast" key=collectors/compactor version=%d oldVersion=%d content=[compactor-%s] oldContent=[compactor-%s]`
	const fmt2 = `level=warn ts=%s caller=instance.go:43 msg="TRACE_TOO_LARGE: max size of trace (52428800) exceeded tenant %s"`
	const fmt3 = `level=info ts=%s caller=compactor.go:242 msg="flushed to block" bytes=%dB objects=%d values=%d`
	const fmt4 = `level=info ts=%s caller=poller.go:133 msg="blocklist poll complete" seconds=%d`
	const fmt5 = `level=info ts=%s caller=flush.go:253 msg="completing block" userid=%s blockID=%s`
	const fmt6 = `level=error ts=%s caller=memcached.go:153 msg="Failed to get keys from memcached" err="memcache: connect timeout to %s:11211"`
	const fmt7 = `level=info ts=%s caller=registry.go:232 tenant=%s msg="collecting metrics" active_series=%d`
	const fmt8 = `level=info ts=%s caller=main.go:107 msg="Starting Grafana Enterprise Traces" version="version=weekly-r138-f1920489, branch=weekly-r138, revision=f1920489"`
	go func() {
		for ctx.Err() == nil {
			t := time.Now()
			logger.LogWithMetadata(log.DEBUG, t, fmt.Sprintf(fmt1, t.Format(time.RFC3339Nano), rand.Intn(100), rand.Intn(100), log.RandSeq(5), log.RandSeq(5)), metadata)
			time.Sleep(time.Duration(rand.Intn(1000)) * time.Millisecond)
		}
	}()
	go func() {
		for ctx.Err() == nil {
			t := time.Now()
			logger.LogWithMetadata(log.WARN, t, fmt.Sprintf(fmt2, t.Format(time.RFC3339Nano), log.RandOrgID()), metadata)
			time.Sleep(time.Duration(rand.Intn(3000)) * time.Millisecond)
		}
	}()
	go func() {
		for ctx.Err() == nil {
			t := time.Now()
			logger.LogWithMetadata(log.INFO, t, fmt.Sprintf(fmt3, t.Format(time.RFC3339Nano), rand.Intn(1000), rand.Intn(1000), rand.Intn(1000)), metadata)
			time.Sleep(time.Duration(rand.Intn(4000)) * time.Millisecond)
		}
	}()
	go func() {
		for ctx.Err() == nil {
			t := time.Now()
			logger.LogWithMetadata(log.INFO, t, fmt.Sprintf(fmt4, t.Format(time.RFC3339Nano), rand.Intn(1000)), metadata)
			time.Sleep(time.Duration(rand.Intn(7000)) * time.Millisecond)
		}
	}()
	go func() {
		for ctx.Err() == nil {
			t := time.Now()
			logger.LogWithMetadata(log.INFO, t, fmt.Sprintf(fmt5, t.Format(time.RFC3339Nano), log.RandOrgID(), log.RandSeq(5)), metadata)
			time.Sleep(time.Duration(rand.Intn(1000)) * time.Millisecond)
		}
	}()
	go func() {
		for ctx.Err() == nil {
			t := time.Now()
			logger.LogWithMetadata(log.ERROR, t, fmt.Sprintf(fmt6, t.Format(time.RFC3339Nano), flog.FakeIP()), metadata)
			time.Sleep(time.Duration(rand.Intn(2000)) * time.Millisecond)
		}
	}()
	go func() {
		for ctx.Err() == nil {
			t := time.Now()
			logger.LogWithMetadata(log.INFO, t, fmt.Sprintf(fmt7, t.Format(time.RFC3339Nano), log.RandOrgID(), rand.Intn(1000)), metadata)
			time.Sleep(time.Duration(rand.Intn(5000)) * time.Millisecond)
		}
	}()
	go func() {
		for ctx.Err() == nil {
			t := time.Now()
			logger.LogWithMetadata(log.INFO, t, fmt.Sprintf(fmt8, t.Format(time.RFC3339Nano)), metadata)
			time.Sleep(20 * time.Second)
		}
	}()
}

var mimirPod = func(ctx context.Context, logger *log.AppLogger, metadata push.LabelsAdapter) {
	go func() {
		for ctx.Err() == nil {
			t := time.Now()
			logger.LogWithMetadata(log.INFO, t, mimirGRPCLog("", "/cortex.Ingester/Push"), metadata)
			time.Sleep(time.Duration(rand.Intn(5000)) * time.Millisecond)
		}
	}()
}

func startFailingMimirPod(ctx context.Context, logger log.Logger) {
	appLogger := log.NewAppLogger(model.LabelSet{
		"cluster":      model.LabelValue(log.Clusters[0]),
		"namespace":    model.LabelValue("mimir"),
		"service_name": "mimir-ingester",
		"file":         "C:\\Windows\\System32\\Config\\Sysevent.txt",
	}, logger)

	go func() {
		for ctx.Err() == nil {
			t := time.Now()
			appLogger.LogWithMetadata(log.ERROR, t, mimirGRPCLog("connection refused to object store", "/cortex.Ingester/Push"), log.RandStructuredMetadata("mimir-ingester", 0))
			time.Sleep(time.Duration(rand.Intn(10000)) * time.Millisecond)
		}
	}()
	go func() {
		for ctx.Err() == nil {
			t := time.Now()
			appLogger.LogWithMetadata(log.INFO, t, mimirGRPCLog("", "/cortex.Ingester/Push"), log.RandStructuredMetadata("mimir-ingester", 0))
			time.Sleep(time.Duration(rand.Intn(500)) * time.Millisecond)
		}
	}()
}

const (
	mimirGrpcLogFmt = `ts=%s caller=grpc_logging.go:66 tenant=%s level=%s method=%s duration=%s msg=gRPC`
	lokiGrpcLogFmt  = `ts=%s caller=grpc_logging.go:66 tenant=%s level=%s method=%s duration=%s msg=gRPC`
	// we need another app may be pyrscope and many different pattern this time to make pattern tab interesting.
)

func mimirGRPCLog(err string, path string) string {
	level := log.INFO
	org := log.RandOrgID()
	if err != "" {
		level = log.ERROR
		org = log.OrgIDs[rand.Intn(len(log.OrgIDs[2:]))]
	}

	log := fmt.Sprintf(
		mimirGrpcLogFmt,
		time.Now().Format(time.RFC3339Nano),
		org,
		level,
		path,
		log.RandDuration(),
	)
	if err != "" {
		log += ` err="` + err + `"`
	}

	return log
}

func lokiGRPCLog(err, path string) string {
	level := log.INFO
	org := log.RandOrgID()
	if err != "" {
		level = log.ERROR
		org = log.OrgIDs[rand.Intn(len(log.OrgIDs[2:]))]
	}

	log := fmt.Sprintf(
		lokiGrpcLogFmt,
		time.Now().Format(time.RFC3339Nano),
		org,
		level,
		path,
		log.RandDuration(),
	)
	if err != "" {
		log += ` err="` + err + `"`
	}

	return log
}

func statusFromLevel(level model.LabelValue) int {
	switch level {
	case log.INFO:
		return 200
	case log.WARN:
		return 400
	case log.ERROR:
		return 500
	default:
		return 200
	}
}
