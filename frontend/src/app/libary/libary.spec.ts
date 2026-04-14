import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Libary } from './libary';

describe('Libary', () => {
  let component: Libary;
  let fixture: ComponentFixture<Libary>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Libary]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Libary);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
