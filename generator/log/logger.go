package log

import (
	"time"

	"github.com/grafana/loki/pkg/push"
	"github.com/prometheus/common/model"
)

type Logger interface {
	Handle(labels model.LabelSet, timestamp time.Time, message string) error
	HandleWithMetadata(labels model.LabelSet, timestamp time.Time, message string, metadata push.LabelsAdapter) error
}

type LoggerFunc func(labels model.LabelSet, timestamp time.Time, message string, metadata push.LabelsAdapter) error

func (f LoggerFunc) Handle(labels model.LabelSet, timestamp time.Time, message string) error {
	return f(labels, timestamp, message, nil)
}
func (f LoggerFunc) HandleWithMetadata(labels model.LabelSet, timestamp time.Time, message string, metadata push.LabelsAdapter) error {
	return f(labels, timestamp, message, metadata)
}
