import { Test, TestingModule } from '@nestjs/testing'
import { BonjoroService } from './bonjoro.service'

describe('TasksService', () => {
  let service: BonjoroService

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BonjoroService],
    }).compile()

    service = module.get<BonjoroService>(BonjoroService)
  })

  it('should be defined', () => {
    expect(service).toBeDefined()
  })
})
