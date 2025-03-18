import { StreamProcessor, EventBus, StorageService, LoggerService } from '@mindburn/shared';

export class ModelStreamProcessor {
  private streamProcessor: StreamProcessor;
  private eventBus: EventBus;
  private storage: StorageService;
  private logger: LoggerService;

  constructor() {
    this.streamProcessor = new StreamProcessor();
    this.eventBus = new EventBus();
    this.storage = new StorageService();
    this.logger = new LoggerService();
  }

  async processModelEvents(): Promise<void> {
    try {
      const records = await this.streamProcessor.getRecords({
        streamName: 'model-events',
        batchSize: 100,
      });

      for (const record of records) {
        await this.processModelEvent(record);
      }
    } catch (error) {
      this.logger.error('Failed to process model events', { error });
      throw error;
    }
  }

  private async processModelEvent(event: any): Promise<void> {
    const { type, modelId, version, metadata } = event;

    try {
      // Log event processing
      this.logger.info('Processing model event', { type, modelId, version });

      // Store event data
      await this.storage.put(`events/${modelId}/${version}/${type}`, {
        timestamp: new Date().toISOString(),
        metadata,
      });

      // Emit processed event
      await this.eventBus.emit('model.event.processed', {
        type,
        modelId,
        version,
        metadata,
        processedAt: new Date().toISOString(),
      });

      this.logger.info('Successfully processed model event', { type, modelId });
    } catch (error) {
      this.logger.error('Failed to process model event', {
        type,
        modelId,
        error,
      });
      throw error;
    }
  }

  async start(): Promise<void> {
    this.logger.info('Starting model stream processor');

    try {
      await this.streamProcessor.start({
        streamName: 'model-events',
        handler: this.processModelEvents.bind(this),
        errorHandler: error => {
          this.logger.error('Stream processing error', { error });
        },
      });
    } catch (error) {
      this.logger.error('Failed to start stream processor', { error });
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping model stream processor');
    await this.streamProcessor.stop();
  }
}
