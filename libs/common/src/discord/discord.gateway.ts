import { InjectDiscordClient, Once } from '@discord-nestjs/core';
import { InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APIEmbed, Client, TextChannel } from 'discord.js';

type BotMessage = {
  request: string;
  correlationId: string;
  userId: string;
  details: Record<string, any>;
};

export class BotGateway {
  private readonly logger: Logger = new Logger(BotGateway.name);

  constructor(
    @InjectDiscordClient()
    private readonly client: Client,
    private readonly configService: ConfigService,
  ) {}

  @Once('ready')
  async onReady() {
    this.logger.log(`Bot ${this.client.user.tag} was started`);
  }

  async fetchChannel(channelId: string): Promise<TextChannel | null> {
    try {
      const textChannel = (await this.client.channels.fetch(
        channelId,
      )) as TextChannel;

      return textChannel ?? null;
    } catch (error) {
      this.logger.error(`Failed to fetch channel with id ${channelId}`);
      this.logger.error(error);

      throw new InternalServerErrorException(
        `Failed to fetch channelId ${channelId}`,
      );
    }
  }

  getChannelFromCache(channelId: string): TextChannel | null {
    try {
      return this.client.channels.cache.get(channelId) as TextChannel;
    } catch (error) {
      this.logger.error(`Failed to get channel from cache for id ${channelId}`);
      this.logger.error(error);

      throw new InternalServerErrorException(
        'Failed to get channel from cache',
      );
    }
  }

  async sendMessage(
    { request, details, correlationId, userId }: BotMessage,
    type?: string,
  ) {
    try {
      const monitorChannelId = this.configService.get(
        'DISCORD_MONITORING_CHANNELID',
      );

      let textChannel = this.getChannelFromCache(monitorChannelId);
      if (!textChannel) {
        textChannel = await this.fetchChannel(monitorChannelId);
      }

      const message = {
        color: 0xff0000,
        title: type + ' ALERT',
        description: 'An error occurred',
        fields: [
          {
            name: 'REQUEST method',
            value: request,
          },
          {
            name: 'CorrelationId',
            value: correlationId,
          },
          {
            name: 'UserId',
            value: userId,
          },
          {
            name: 'DETAILS',
            value:
              JSON.stringify(details).length > 1024
                ? JSON.stringify(details).substring(0, 1024)
                : JSON.stringify(details),
          },
        ],
        timestamp: new Date().toISOString(),
      } as APIEmbed;

      await textChannel.send({ embeds: [message] });

      this.logger.log(`Successfully sent message to discord`);
    } catch (error) {
      this.logger.error(`Failed to send alert to discord`);
      this.logger.debug('Message', {
        request,
        details,
        correlationId,
        userId,
        type,
      });
      this.logger.error(error);
      this.logger.error(JSON.stringify(error));
    }
  }
}
