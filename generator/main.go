package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"time"

	"github.com/grafana/explore-logs/generator/log"
	"github.com/grafana/loki-client-go/loki"
	"github.com/grafana/loki/pkg/push"
	"github.com/prometheus/common/model"
)

func main() {
	url := flag.String("url", "http://localhost:3100/loki/api/v1/push", "Loki URL")
	dry := flag.Bool("dry", false, "Dry run: log to stdout instead of Loki")
	flag.Parse()

	cfg, err := loki.NewDefaultConfig(*url)
	if err != nil {
		panic(err)
	}
	cfg.BackoffConfig.MaxRetries = 1
	cfg.BackoffConfig.MinBackoff = 100 * time.Millisecond
	cfg.BackoffConfig.MaxBackoff = 100 * time.Millisecond
	client, err := loki.New(cfg)
	if err != nil {
		panic(err)
	}
	defer client.Stop()

	var logger log.Logger = client
	if *dry {
		logger = log.LoggerFunc(func(labels model.LabelSet, timestamp time.Time, message string, metadata push.LabelsAdapter) error {
			fmt.Println(labels, timestamp, message, metadata)
			return nil
		})
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()

	// Creates and starts all apps.
	for namespace, apps := range generators {
		for serviceName, generator := range apps {
			log.ForAllClusters(namespace, serviceName, func(labels model.LabelSet, metadata push.LabelsAdapter) {
				// Remove `metadata` from nginx logs
				if serviceName == "nginx" {
					metadata = push.LabelsAdapter{}
				}
				if strings.Contains(string(serviceName), "-otel") {
					logger = log.NewOtelLogger()
				}
				generator(ctx, log.NewAppLogger(labels, logger), metadata)
			})
		}
	}
	startFailingMimirPod(ctx, logger)

	<-ctx.Done()
}
