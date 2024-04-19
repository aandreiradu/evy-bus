import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { GatewayService } from './gateway.service';
import { AccountKeyGuard } from '@app/common/guards';

@Controller()
export class GatewayController {
  constructor(private readonly gatewayService: GatewayService) {}

  @Post('/create-queue')
  @UseGuards(AccountKeyGuard)
  async createQueue(@Body() body: any) {
    return this.gatewayService.createQueue(body['accountKey'], body);
  }

  @Post('send-message')
  async sendMessage(@Body() payload: any) {
    console.log('body', payload);
    await this.gatewayService.publishToEventsQueue(payload);

    return {
      message: 'Message received successfully',
    };
  }
}
