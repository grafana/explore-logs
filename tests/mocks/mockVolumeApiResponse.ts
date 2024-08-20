export const mockVolumeApiResponse = {
    "status": "success",
    "data": {
        "resultType": "vector",
        "result": [
            {
                "metric": {
                    "service_name": "tempo-distributor"
                },
                "value": [
                    1722536046.066,
                    "53826521"
                ]
            },
            {
                "metric": {
                    "service_name": "tempo-ingester"
                },
                "value": [
                    1722536046.066,
                    "51585442"
                ]
            },
            {
                "metric": {
                    "service_name": "mimir-ingester"
                },
                "value": [
                    1722536046.066,
                    "2340497"
                ]
            },
            {
                "metric": {
                    "service_name": "httpd"
                },
                "value": [
                    1722536046.066,
                    "2093405"
                ]
            },
            {
                "metric": {
                    "service_name": "nginx-json"
                },
                "value": [
                    1722536046.066,
                    "1654774"
                ]
            },
            {
                "metric": {
                    "service_name": "mimir-distributor"
                },
                "value": [
                    1722536046.066,
                    "1516802"
                ]
            },
            {
                "metric": {
                    "service_name": "mimir-querier"
                },
                "value": [
                    1722536046.066,
                    "984900"
                ]
            },
            {
                "metric": {
                    "service_name": "nginx"
                },
                "value": [
                    1722536046.066,
                    "926310"
                ]
            },
            {
                "metric": {
                    "service_name": "apache"
                },
                "value": [
                    1722536046.066,
                    "874633"
                ]
            },
            {
                "metric": {
                    "service_name": "mimir-ruler"
                },
                "value": [
                    1722536046.066,
                    "301744"
                ]
            }
        ],
        "stats": {
            "summary": {
                "bytesProcessedPerSecond": 0,
                "linesProcessedPerSecond": 0,
                "totalBytesProcessed": 0,
                "totalLinesProcessed": 0,
                "execTime": 0.375358251,
                "queueTime": 0,
                "subqueries": 0,
                "totalEntriesReturned": 10,
                "splits": 1,
                "shards": 0,
                "totalPostFilterLines": 0,
                "totalStructuredMetadataBytesProcessed": 0
            },
            "querier": {
                "store": {
                    "totalChunksRef": 0,
                    "totalChunksDownloaded": 0,
                    "chunksDownloadTime": 0,
                    "queryReferencedStructuredMetadata": false,
                    "chunk": {
                        "headChunkBytes": 0,
                        "headChunkLines": 0,
                        "decompressedBytes": 0,
                        "decompressedLines": 0,
                        "compressedBytes": 0,
                        "totalDuplicates": 0,
                        "postFilterLines": 0,
                        "headChunkStructuredMetadataBytes": 0,
                        "decompressedStructuredMetadataBytes": 0
                    },
                    "chunkRefsFetchTime": 0,
                    "congestionControlLatency": 0,
                    "pipelineWrapperFilteredLines": 0
                }
            },
            "ingester": {
                "totalReached": 0,
                "totalChunksMatched": 0,
                "totalBatches": 0,
                "totalLinesSent": 0,
                "store": {
                    "totalChunksRef": 0,
                    "totalChunksDownloaded": 0,
                    "chunksDownloadTime": 0,
                    "queryReferencedStructuredMetadata": false,
                    "chunk": {
                        "headChunkBytes": 0,
                        "headChunkLines": 0,
                        "decompressedBytes": 0,
                        "decompressedLines": 0,
                        "compressedBytes": 0,
                        "totalDuplicates": 0,
                        "postFilterLines": 0,
                        "headChunkStructuredMetadataBytes": 0,
                        "decompressedStructuredMetadataBytes": 0
                    },
                    "chunkRefsFetchTime": 0,
                    "congestionControlLatency": 0,
                    "pipelineWrapperFilteredLines": 0
                }
            },
            "cache": {
                "chunk": {
                    "entriesFound": 0,
                    "entriesRequested": 0,
                    "entriesStored": 0,
                    "bytesReceived": 0,
                    "bytesSent": 0,
                    "requests": 0,
                    "downloadTime": 0,
                    "queryLengthServed": 0
                },
                "index": {
                    "entriesFound": 0,
                    "entriesRequested": 0,
                    "entriesStored": 0,
                    "bytesReceived": 0,
                    "bytesSent": 0,
                    "requests": 0,
                    "downloadTime": 0,
                    "queryLengthServed": 0
                },
                "result": {
                    "entriesFound": 0,
                    "entriesRequested": 0,
                    "entriesStored": 0,
                    "bytesReceived": 0,
                    "bytesSent": 0,
                    "requests": 0,
                    "downloadTime": 0,
                    "queryLengthServed": 0
                },
                "statsResult": {
                    "entriesFound": 0,
                    "entriesRequested": 0,
                    "entriesStored": 0,
                    "bytesReceived": 0,
                    "bytesSent": 0,
                    "requests": 0,
                    "downloadTime": 0,
                    "queryLengthServed": 0
                },
                "volumeResult": {
                    "entriesFound": 0,
                    "entriesRequested": 0,
                    "entriesStored": 0,
                    "bytesReceived": 0,
                    "bytesSent": 0,
                    "requests": 0,
                    "downloadTime": 0,
                    "queryLengthServed": 0
                },
                "seriesResult": {
                    "entriesFound": 0,
                    "entriesRequested": 0,
                    "entriesStored": 0,
                    "bytesReceived": 0,
                    "bytesSent": 0,
                    "requests": 0,
                    "downloadTime": 0,
                    "queryLengthServed": 0
                },
                "labelResult": {
                    "entriesFound": 0,
                    "entriesRequested": 0,
                    "entriesStored": 0,
                    "bytesReceived": 0,
                    "bytesSent": 0,
                    "requests": 0,
                    "downloadTime": 0,
                    "queryLengthServed": 0
                },
                "instantMetricResult": {
                    "entriesFound": 0,
                    "entriesRequested": 0,
                    "entriesStored": 0,
                    "bytesReceived": 0,
                    "bytesSent": 0,
                    "requests": 0,
                    "downloadTime": 0,
                    "queryLengthServed": 0
                }
            },
            "index": {
                "totalChunks": 0,
                "postFilterChunks": 0,
                "shardsDuration": 0
            }
        }
    }
}
