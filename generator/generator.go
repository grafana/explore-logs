package main

import (
	"context"
	"fmt"
	"math/rand"
	"time"

	"github.com/cyriltovena/loki-log-generator/flog"
	"github.com/prometheus/common/model"
)

type AppLogger struct {
	labels model.LabelSet
	levels map[model.LabelValue]model.LabelSet
	logger Logger
}

func (app *AppLogger) Log(level model.LabelValue, t time.Time, message string) {
	labels, ok := app.levels[level]
	if !ok {
		labels = app.labels
	}
	_ = app.logger.Handle(labels, t, message)
}

type Logger interface {
	Handle(labels model.LabelSet, timestamp time.Time, message string) error
}

type LoggerFunc func(labels model.LabelSet, timestamp time.Time, message string) error

func (f LoggerFunc) Handle(labels model.LabelSet, timestamp time.Time, message string) error {
	return f(labels, timestamp, message)
}

func NewAppLogger(labels model.LabelSet, logger Logger) *AppLogger {
	levels := map[model.LabelValue]model.LabelSet{
		DEBUG: labels.Merge(model.LabelSet{"level": DEBUG}),
		INFO:  labels.Merge(model.LabelSet{"level": INFO}),
		WARN:  labels.Merge(model.LabelSet{"level": WARN}),
		ERROR: labels.Merge(model.LabelSet{"level": ERROR}),
	}
	return &AppLogger{
		labels: labels,
		levels: levels,
		logger: logger,
	}
}

type LogGenerator func(ctx context.Context, logger *AppLogger)

var generators = map[model.LabelValue]map[model.LabelValue]LogGenerator{
	"gateway": {
		"apache": func(ctx context.Context, logger *AppLogger) {
			go func() {
				for ctx.Err() == nil {
					level := randLevel()
					t := time.Now()
					logger.Log(level, t, flog.NewApacheCommonLog(t, randURI(), statusFromLevel(level)))
					time.Sleep(time.Duration(rand.Intn(5000)) * time.Millisecond)
				}
			}()
		},
		"httpd": func(ctx context.Context, logger *AppLogger) {
			go func() {
				for ctx.Err() == nil {
					level := randLevel()
					t := time.Now()
					logger.Log(level, t, flog.NewApacheCombinedLog(t, randURI(), statusFromLevel(level)))
					time.Sleep(time.Duration(rand.Intn(5000)) * time.Millisecond)
				}
			}()
		},
		// "syslog": func(ctx context.Context, logger *AppLogger) {
		// 	go func() {
		// 		for ctx.Err() == nil {
		// 			level := randLevel()
		// 			t := time.Now()
		// 			logger.Log(level, t, flog.NewRFC3164Log(t))
		// 			time.Sleep(time.Duration(rand.Intn(5000)) * time.Millisecond)
		// 		}
		// 	}()
		// },
		// "syslog-ng": func(ctx context.Context, logger *AppLogger) {
		// 	go func() {
		// 		for ctx.Err() == nil {
		// 			level := randLevel()
		// 			t := time.Now()
		// 			logger.Log(level, t, flog.NewRFC5424Log(t))
		// 			time.Sleep(time.Duration(rand.Intn(5000)) * time.Millisecond)
		// 		}
		// 	}()
		// },
		"nginx": func(ctx context.Context, logger *AppLogger) {
			go func() {
				for ctx.Err() == nil {
					level := randLevel()
					t := time.Now()
					logger.Log(level, t, flog.NewCommonLogFormat(t, randURI(), statusFromLevel(level)))
					time.Sleep(time.Duration(rand.Intn(5000)) * time.Millisecond)
				}
			}()
		},
		"nginx-json": func(ctx context.Context, logger *AppLogger) {
			go func() {
				for ctx.Err() == nil {
					level := randLevel()
					t := time.Now()
					logger.Log(level, t, flog.NewJSONLogFormat(t, randURI(), statusFromLevel(level)))
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
}

var noisyTempo = func(ctx context.Context, logger *AppLogger) {
	const fmt1 = `level=debug ts=%s caller=broadcast.go:48 msg="Invalidating forwarded broadcast" key=collectors/compactor version=%d oldVersion=%d content=[compactor-%s] oldContent=[compactor-%s]`
	const fmt2 = `level=warn ts=%s caller=instance.go:43 msg="TRACE_TOO_LARGE: max size of trace (52428800) exceeded tenant %s"`
	const fmt3 = `level=info ts=%s caller=compactor.go:242 msg="flushed to block" bytes=%d objects=%d values=%d`
	const fmt4 = `level=info ts=%s caller=poller.go:133 msg="blocklist poll complete" seconds=%d`
	const fmt5 = `level=info ts=%s caller=flush.go:253 msg="completing block" userid=%s blockID=%s`
	const fmt6 = `level=error ts=%s caller=memcached.go:153 msg="Failed to get keys from memcached" err="memcache: connect timeout to %s:11211"`
	const fmt7 = `level=info ts=%s caller=registry.go:232 tenant=%s msg="collecting metrics" active_series=%d`
	const fmt8 = `level=info ts=%s caller=main.go:107 msg="Starting Grafana Enterprise Traces" version="version=weekly-r138-f1920489, branch=weekly-r138, revision=f1920489"`
	go func() {
		for ctx.Err() == nil {
			t := time.Now()
			logger.Log(DEBUG, t, fmt.Sprintf(fmt1, t.Format(time.RFC3339Nano), rand.Intn(100), rand.Intn(100), randSeq(5), randSeq(5)))
			time.Sleep(time.Duration(rand.Intn(1000)) * time.Millisecond)
		}
	}()
	go func() {
		for ctx.Err() == nil {
			t := time.Now()
			logger.Log(WARN, t, fmt.Sprintf(fmt2, t.Format(time.RFC3339Nano), randOrgID()))
			time.Sleep(time.Duration(rand.Intn(3000)) * time.Millisecond)
		}
	}()
	go func() {
		for ctx.Err() == nil {
			t := time.Now()
			logger.Log(INFO, t, fmt.Sprintf(fmt3, t.Format(time.RFC3339Nano), rand.Intn(1000), rand.Intn(1000), rand.Intn(1000)))
			time.Sleep(time.Duration(rand.Intn(4000)) * time.Millisecond)
		}
	}()
	go func() {
		for ctx.Err() == nil {
			t := time.Now()
			logger.Log(INFO, t, fmt.Sprintf(fmt4, t.Format(time.RFC3339Nano), rand.Intn(1000)))
			time.Sleep(time.Duration(rand.Intn(7000)) * time.Millisecond)
		}
	}()
	go func() {
		for ctx.Err() == nil {
			t := time.Now()
			logger.Log(INFO, t, fmt.Sprintf(fmt5, t.Format(time.RFC3339Nano), randOrgID(), randSeq(5)))
			time.Sleep(time.Duration(rand.Intn(1000)) * time.Millisecond)
		}
	}()
	go func() {
		for ctx.Err() == nil {
			t := time.Now()
			logger.Log(ERROR, t, fmt.Sprintf(fmt6, t.Format(time.RFC3339Nano), flog.FakeIP()))
			time.Sleep(time.Duration(rand.Intn(2000)) * time.Millisecond)
		}
	}()
	go func() {
		for ctx.Err() == nil {
			t := time.Now()
			logger.Log(INFO, t, fmt.Sprintf(fmt7, t.Format(time.RFC3339Nano), randOrgID(), rand.Intn(1000)))
			time.Sleep(time.Duration(rand.Intn(5000)) * time.Millisecond)
		}
	}()
	go func() {
		for ctx.Err() == nil {
			t := time.Now()
			logger.Log(INFO, t, fmt.Sprintf(fmt8, t.Format(time.RFC3339Nano)))
			time.Sleep(20 * time.Second)
		}
	}()
}

var mimirPod = func(ctx context.Context, logger *AppLogger) {
	go func() {
		for ctx.Err() == nil {
			t := time.Now()
			logger.Log(INFO, t, mimirGRPCLog("", "/cortex.Ingester/Push"))
			time.Sleep(time.Duration(rand.Intn(5000)) * time.Millisecond)
		}
	}()
}

func startFailingMimirPod(ctx context.Context, logger Logger) {
	appLogger := NewAppLogger(model.LabelSet{
		"cluster":      model.LabelValue(clusters[0]),
		"namespace":    model.LabelValue("mimir"),
		"service_name": "mimir-ingester",
		"pod":          "mimir-ingester" + "-" + model.LabelValue(randSeq(5)),
	}, logger)

	go func() {
		for ctx.Err() == nil {
			t := time.Now()
			appLogger.Log(ERROR, t, mimirGRPCLog("connection refused to object store", "/cortex.Ingester/Push"))
			time.Sleep(time.Duration(rand.Intn(10000)) * time.Millisecond)
		}
	}()
	go func() {
		for ctx.Err() == nil {
			t := time.Now()
			appLogger.Log(INFO, t, mimirGRPCLog("", "/cortex.Ingester/Push"))
			time.Sleep(time.Duration(rand.Intn(500)) * time.Millisecond)
		}
	}()
}

const (
	mimirGrpcLogFmt = `ts=%s caller=grpc_logging.go:66 tenant=%s level=%s method=%s duration=%s msg=gRPC`
	// we need another app may be pyrscope and many different pattern this time to make pattern tab interesting.
)

func mimirGRPCLog(err string, path string) string {
	level := INFO
	org := randOrgID()
	if err != "" {
		level = ERROR
		org = orgIDs[rand.Intn(len(orgIDs[2:]))]
	}

	log := fmt.Sprintf(
		mimirGrpcLogFmt,
		time.Now().Format(time.RFC3339Nano),
		org,
		level,
		path,
		randDuration(),
	)
	if err != "" {
		log += ` err="` + err + `"`
	}

	return log
}

func statusFromLevel(level model.LabelValue) int {
	switch level {
	case INFO:
		return 200
	case WARN:
		return 400
	case ERROR:
		return 500
	default:
		return 200
	}
}
