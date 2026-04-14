import { ComponentFixture, TestBed } from '@angular/core/testing';

import { YourLibary } from './your-libary';

describe('YourLibary', () => {
  let component: YourLibary;
  let fixture: ComponentFixture<YourLibary>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [YourLibary]
    })
    .compileComponents();

    fixture = TestBed.createComponent(YourLibary);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
