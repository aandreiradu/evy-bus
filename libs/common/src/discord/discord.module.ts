import { DiscordModule } from '@discord-nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BotGateway } from './discord.gateway';

@Module({
  imports: [
    DiscordModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        token: configService.get('DISCORD_TOKEN'),
        discordClientOptions: {
          intents: [],
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [BotGateway],
  exports: [BotGateway],
})
export class DiscordBotModule {}
