import { NotificationModel } from './model/notification.model.js';

export type NotificationInput = Pick<NotificationModel, 'recipientId' | 'type' | 'title' | 'body' | 'relatedResourceType' | 'relatedResourceId'>;
