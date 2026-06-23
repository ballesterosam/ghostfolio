import { CdkTextareaAutosize, TextFieldModule } from '@angular/cdk/text-field';
import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  DestroyRef,
  ElementRef,
  inject,
  ViewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  addOutline,
  arrowBackOutline,
  chatbubbleEllipsesOutline,
  closeOutline,
  sendOutline,
  timeOutline,
  trashOutline
} from 'ionicons/icons';
import { MarkdownModule } from 'ngx-markdown';

import {
  HipatiaApiService,
  HipatiaConversation,
  HipatiaMessage
} from '../../services/hipatia-api.service';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CdkTextareaAutosize,
    DatePipe,
    IonIcon,
    MarkdownModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatListModule,
    MatProgressSpinnerModule,
    ReactiveFormsModule,
    TextFieldModule
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  selector: 'gf-hipatia-chat',
  styleUrls: ['./hipatia-chat.component.scss'],
  templateUrl: './hipatia-chat.component.html'
})
export class GfHipatiaChat {
  @ViewChild('messagesContainer')
  private messagesContainer: ElementRef<HTMLDivElement>;

  protected readonly messageControl = new FormControl('');
  protected readonly inputPlaceholder = $localize`Ask Hipatia...`;
  protected isPanelOpen = false;
  protected isLoading = false;
  protected isLoadingHistory = false;
  protected messages: HipatiaMessage[] = [];
  protected conversations: HipatiaConversation[] = [];
  protected viewMode: 'chat' | 'history' = 'chat';
  protected currentConversationId: string | undefined;

  private readonly changeDetectorRef = inject(ChangeDetectorRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly hipatiaApiService = inject(HipatiaApiService);

  public constructor() {
    addIcons({
      addOutline,
      arrowBackOutline,
      chatbubbleEllipsesOutline,
      closeOutline,
      sendOutline,
      timeOutline,
      trashOutline
    });
  }

  protected openPanel() {
    this.isPanelOpen = true;
    this.viewMode = 'chat';
    this.changeDetectorRef.markForCheck();
  }

  protected closePanel() {
    this.isPanelOpen = false;
    this.changeDetectorRef.markForCheck();
  }

  protected onNewConversation() {
    this.messages = [];
    this.currentConversationId = undefined;
    this.viewMode = 'chat';
    this.changeDetectorRef.markForCheck();
  }

  protected openHistory() {
    this.viewMode = 'history';
    this.isLoadingHistory = true;
    this.changeDetectorRef.markForCheck();

    this.hipatiaApiService
      .getConversations()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (conversations) => {
          this.conversations = conversations;
          this.isLoadingHistory = false;
          this.changeDetectorRef.markForCheck();
        },
        error: () => {
          this.isLoadingHistory = false;
          this.changeDetectorRef.markForCheck();
        }
      });
  }

  protected loadConversation(conversationId: string) {
    this.currentConversationId = conversationId;
    this.viewMode = 'chat';
    this.isLoading = true;
    this.changeDetectorRef.markForCheck();

    this.hipatiaApiService
      .getMessages(conversationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (messages) => {
          this.messages = messages;
          this.isLoading = false;
          this.changeDetectorRef.markForCheck();
          this.scrollToBottom();
        },
        error: () => {
          this.isLoading = false;
          this.changeDetectorRef.markForCheck();
        }
      });
  }

  protected deleteConversation(conversationId: string, event: MouseEvent) {
    event.stopPropagation();

    this.hipatiaApiService
      .deleteConversation(conversationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.conversations = this.conversations.filter(
          (c) => c.id !== conversationId
        );

        if (this.currentConversationId === conversationId) {
          this.onNewConversation();
        }

        this.changeDetectorRef.markForCheck();
      });
  }

  protected onEnterKey(event: KeyboardEvent) {
    if (!event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  protected sendMessage() {
    const content = this.messageControl.value?.trim();

    if (!content || this.isLoading) {
      return;
    }

    const userMessage: HipatiaMessage = {
      id: `temp-${Date.now()}`,
      content,
      role: 'USER',
      createdAt: new Date().toISOString()
    };

    this.messages = [...this.messages, userMessage];
    this.messageControl.reset();
    this.isLoading = true;
    this.changeDetectorRef.markForCheck();
    this.scrollToBottom();

    this.hipatiaApiService
      .chat({
        conversationId: this.currentConversationId,
        message: content
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ conversationId, reply }) => {
          this.currentConversationId = conversationId;
          this.isLoading = false;

          const assistantMessage: HipatiaMessage = {
            id: `temp-reply-${Date.now()}`,
            content: reply,
            role: 'ASSISTANT',
            createdAt: new Date().toISOString()
          };

          this.messages = [...this.messages, assistantMessage];
          this.changeDetectorRef.markForCheck();
          this.scrollToBottom();
        },
        error: () => {
          this.isLoading = false;
          this.changeDetectorRef.markForCheck();
        }
      });
  }

  private scrollToBottom() {
    setTimeout(() => {
      if (this.messagesContainer?.nativeElement) {
        const el = this.messagesContainer.nativeElement;
        el.scrollTop = el.scrollHeight;
      }
    }, 50);
  }
}
