import { defineProperty, isNullable } from 'cosmokit'
import { Context } from '.'
import { Bot } from './bot'
import { Channel, Event, GuildMember, Message, User } from '@satorijs/protocol'
import h from '@satorijs/element'

declare module '@satorijs/protocol' {
  interface SendOptions {
    session?: Session
  }
}

// Accessors
export interface Session {
  type: string
  subtype: string
  subsubtype: string
  selfId: string
  platform: string
  timestamp: number
  userId: string
  channelId: string
  guildId: string
  messageId: string
  operatorId: string
  roleId: string
  quote: Message
}

export class Session {
  static counter = 0

  public id: number
  public bot: Bot
  public app: Context['root']
  public event: Event
  public locales: string[] = []

  constructor(bot: Bot, payload: Partial<Event>) {
    payload.selfId ??= bot.selfId
    payload.platform ??= bot.platform
    payload.timestamp ??= Date.now()
    this.event = payload as Event
    this.id = ++Session.counter
    Object.assign(this, payload)
    for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(payload))) {
      if (descriptor.enumerable) continue
      Object.defineProperty(this, key, descriptor)
    }
    defineProperty(this, 'bot', bot)
    defineProperty(this, 'app', bot.ctx.root)
    this.initialize()
  }

  initialize() {}

  /** @deprecated */
  get data() {
    return this.event
  }

  get isDirect() {
    return this.event.channel.type === Channel.Type.DIRECT
  }

  set isDirect(value) {
    (this.event.channel ??= {} as Channel).type = value ? Channel.Type.DIRECT : Channel.Type.TEXT
  }

  get author(): GuildMember & User {
    return {
      ...this.event.user,
      ...this.event.member,
      userId: this.event.user?.id,
      username: this.event.user?.name,
      nickname: this.event.member?.name,
    }
  }

  get uid() {
    return `${this.platform}:${this.userId}`
  }

  get gid() {
    return `${this.platform}:${this.guildId}`
  }

  get cid() {
    return `${this.platform}:${this.channelId}`
  }

  get fid() {
    return `${this.platform}:${this.channelId}:${this.userId}`
  }

  get sid() {
    return `${this.platform}:${this.selfId}`
  }

  get elements() {
    return this.event.message?.elements
  }

  set elements(value) {
    this.event.message ??= {}
    this.event.message.elements = value
  }

  get content(): string | undefined {
    return this.event.message?.elements?.join('')
  }

  set content(value: string | undefined) {
    (this.event.message ??= {}).elements = isNullable(value) ? value : h.parse(value)
  }

  setInternal(type: string, data: any) {
    this.event._type = type
    this.event._data = data
    const internal = Object.create(this.bot.internal)
    defineProperty(this, type, Object.assign(internal, data))
  }

  async transform(elements: h[]): Promise<h[]> {
    return await h.transformAsync(elements, ({ type, attrs, children }, session) => {
      const render = type === 'component' ? attrs.is : this.app['component:' + type]
      return render?.(attrs, children, session) ?? true
    }, this)
  }

  toJSON(): Event {
    return { ...this.event, id: this.id }
  }
}

export function defineAccessor(prototype: {}, name: string, keys: string[]) {
  Object.defineProperty(prototype, name, {
    get() {
      return keys.reduce((data, key) => data?.[key], this)
    },
    set(value) {
      // Do not set undefined value
      // See https://github.com/satorijs/satori/issues/166
      if (value === undefined) return
      const _keys = keys.slice()
      const last = _keys.pop()
      const data = _keys.reduce((data, key) => data[key] ??= {}, this)
      data[last] = value
    },
  })
}

defineAccessor(Session.prototype, 'type', ['event', 'type'])
defineAccessor(Session.prototype, 'subtype', ['event', 'subtype'])
defineAccessor(Session.prototype, 'subsubtype', ['event', 'subsubtype'])
defineAccessor(Session.prototype, 'selfId', ['event', 'selfId'])
defineAccessor(Session.prototype, 'platform', ['event', 'platform'])
defineAccessor(Session.prototype, 'timestamp', ['event', 'timestamp'])
defineAccessor(Session.prototype, 'userId', ['event', 'user', 'id'])
defineAccessor(Session.prototype, 'channelId', ['event', 'channel', 'id'])
defineAccessor(Session.prototype, 'channelName', ['event', 'channel', 'name'])
defineAccessor(Session.prototype, 'guildId', ['event', 'guild', 'id'])
defineAccessor(Session.prototype, 'guildName', ['event', 'guild', 'name'])
defineAccessor(Session.prototype, 'messageId', ['event', 'message', 'id'])
defineAccessor(Session.prototype, 'operatorId', ['event', 'operator', 'id'])
defineAccessor(Session.prototype, 'roleId', ['event', 'role', 'id'])
defineAccessor(Session.prototype, 'quote', ['event', 'message', 'quote'])
